import express from 'express';
import Ping from './handlers/Ping.mjs';
import Pull from './handlers/Pull.mjs';
import Ontology from './handlers/Ontology.mjs';
import NameSpace from './handlers/NameSpace.mjs';
import Redact from './handlers/Redact.mjs';
import Analysis from './handlers/Analysis.mjs';
import Accumulator from "./handlers/Accumulator.mjs";
// import Stash from './handlers/Stash.mjs';
import fs from "fs";
import path from "path";
import Componentry from "@metric-im/componentry";

export default class MetricServer extends Componentry.Module {
    constructor(connector) {
        super(connector,import.meta.url);
        this.connector = connector;
        this.refinery = {};
        this.accumulators = {};
        this.collectionName = 'event';
    }
    /**
     * Set collection is used to rename the default media collection
     * @param name alternate name to 'media'
     */
    setCollection(name) {
        this.collectionName = name;
    }
    get library() {
        return {
            'chartjs':'/chart.js/dist/chart.js',
            'chartjs-zoom':'/chartjs-plugin-zoom/dist/chartjs-plugin-zoom.js',
            'hammer.min.js':'/hammerjs/hammer.min.js',
            'hammer.min.js.map':'/hammerjs/hammer.min.js.map',
        };
    }
    initializeEvent(account,ns,req) {
        let body = {
            _id:this.connector.idForge.datedId(),
            _account:account,
            _ns:ns,
            _time: new Date(),
        }
        // If it's a web event pull context from the request
        if (req) {
            body.hostname = req.hostname;
            body.url = req.url
            body._origin = {
                ip: req.headers['x-forwarded-for'] || req.ip,
                ua: req.get('User-Agent')
            }
            if (body._origin.ip === '::1') body._origin.ip = '208.157.149.67'; ///TODO: For dev purposes, remove
            if (body._origin.ip === '::ffff:127.0.0.1') body._origin.ip = req.headers['x-forwarded-for'];
        }
        return body;
    }
    static async mint(connector) {
        let instance = new MetricServer(connector);
        let refiners = fs.readdirSync(path.resolve(instance.rootPath+"/refinery"));
        for (let file of refiners) {
            let Refiner = await import('./refinery/'+file);
            let name = file.replace(/(\.mjs|\.js)/,"");
            instance.refinery[name] = new Refiner.default(connector);
        }
        instance.Accumulator = await Accumulator.mint(instance.rootPath);
        NameSpace.Accumulator = instance.Accumulator;
        NameSpace.refinery = instance.refinery;
        instance.handlers = {
            ping:new Ping(instance.connector,this.collectionName),
            pull:new Pull(instance.connector,this.collectionName),
            ontology:new Ontology(instance.connector,this.collectionName),
            redact:new Redact(instance.connector,this.collectionName),
            analysis:new Analysis(instance.connector,this.collectionName)
        }
        instance._api = {
            ping:instance.handlers.ping.execute.bind(instance.handlers.ping),
            pull:instance.handlers.pull.execute.bind(instance.handlers.pull),
            initializeEvent:instance.initializeEvent,
            connector:instance.connector
        }
        return instance;
    }
    static async getApi(db,options) {
        let componentry = {}
        componentry = typeof(db)==='string'
          ?{profile:Object.assign({mongo:{host:db}},options)}
          :{profile:options,db:db};
        const connector = await Componentry.Connector.mint(componentry);
        let instance = await MetricServer.mint(connector);
        return instance._api;
    }
    routes() {
        let router = express.Router();
        // set routes services
        router.use('/ping',this.handlers.ping.routes());
        router.use('/pull',this.handlers.pull.routes());
        router.use('/ontology',this.handlers.ontology.routes());
        router.use('/redact',this.handlers.redact.routes());
        router.use('/analysis',this.handlers.analysis.routes());
        // router.use('/stash',(new Stash(this.connector)).routes());
        return router;
    }
}
export async function getApi(db,options) {
    let componentry = {}
    componentry = typeof(db)==='string'
      ?{profile:Object.assign({mongo:{host:db}},options)}
      :{profile:options,db:db};
    const connector = await Componentry.Connector.mint(componentry);
    let instance = await MetricServer.mint(connector);
    return instance._api;
}
