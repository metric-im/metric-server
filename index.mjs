import express from 'express';
import Ping from './handlers/Ping.mjs';
import Pull from './handlers/Pull.mjs';
import Ontology from './handlers/Ontology.mjs';
import NameSpace from './handlers/NameSpace.mjs';
import Redact from './handlers/Redact.mjs';
import Schema from './handlers/Schema.mjs';
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
    initializeEvent(account,req) {
        try {
            let parts = req.params[0].split('/');
            let format = 'json';
            if (parts.length > 1) format = parts.shift();
            let namespace = parts.shift();
            let body = Object.assign( {},req.query,{
                _id:this.connector.idForge.datedId(),
                _account:account,
                _ns:namespace,
                _time: new Date(),
            })
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
        } catch(e) {
            console.log("Error parsing event:\n"+e);
            throw("Error parsing event");
        }
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
            schema:new Schema(instance.connector,this.collectionName),
            analysis:new Analysis(instance.connector,this.collectionName)
        }
        // Extend the internal metric handlers to the rest of the app through connector.api.
        instance.connector.api = {
            ping:instance.handlers.ping.execute.bind(instance.handlers.ping),
            pull:instance.handlers.pull.execute.bind(instance.handlers.pull),
            schema:instance.handlers.schema.execute.bind(instance.handlers.schema),
            initializeEvent:instance.initializeEvent.bind(instance)
        };

        return instance;
    }
    static async getApi(db,options) {
        const componentry = typeof(db)==='string'
          ?{profile:Object.assign({mongo:{host:db}},options)}
          :{profile:options,db:db};
        componentry.idForge = Componentry.IdForge;
        const connector = await ConnectorStub.mint(componentry);
        let instance = await MetricServer.mint(connector);
        return instance.connector.api;
    }
    routes() {
        let router = express.Router();
        // set routes services
        router.use('/ping',this.handlers.ping.routes());
        router.use('/pull',this.handlers.pull.routes());
        router.use('/ontology',this.handlers.ontology.routes());
        router.use('/redact',this.handlers.redact.routes());
        router.use('/schema',this.handlers.schema.routes());
        router.use('/analysis',this.handlers.analysis.routes());
        // router.use('/stash',(new Stash(this.connector)).routes());
        return router;
    }
}
import mongodb from 'mongodb';
export class ConnectorStub {
    constructor(componentry) {
        this.componentry = componentry
        this.profile = componentry.profile;
        this.idForge = componentry.idForge;
    }

    /**
     * Mint is an async implementation for new Connector
     * @param profile PROD, DEV or STAGING
     * @returns Connector
     */
    static async mint(componentry) {
        let connector = new ConnectorStub(componentry);
        if (connector.profile.init) await connector.profile.init();
        if (componentry.db) {
            connector.db = componentry.db
        } else if (connector.profile.mongo) {
            connector.MongoClient = mongodb.MongoClient;
            let mongo = await connector.MongoClient.connect(
              connector.profile.mongo.host,
              {useNewUrlParser:true,useUnifiedTopology:true}
            );
            connector.db = mongo.db();
        }
        return connector;
    }

    /**
     * Grant all ACL requests owner access to the host system. Override the stub
     * to tune access control if desired.
     * @returns {{test: (function(): {all: function(): number, owner: function(): number, read: function(): number, write: function(): number}), get: (function(): {all: function(): number, owner: function(): number, read: function(): number, write: function(): number}), assign: (function(): {all: function(): number, owner: function(): number, read: function(): number, write: function(): number})}}
     */
    get acl() {
        return {assign:this.level,test:this.level,get:this.level}
    }
    get level() {
        return {all:()=>true,read:()=>true,write:()=>true,owner:()=>true}
    }
}

