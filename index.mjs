import express from 'express';
import Ping from './handlers/Ping.mjs';
import Pull from './handlers/Pull.mjs';
import Ontology from './handlers/Ontology.mjs';
import NameSpace from './handlers/NameSpace.mjs';
import Redact from './handlers/Redact.mjs';
import Analysis from './handlers/Analysis.mjs';
import Accumulator from "./handlers/Accumulator.mjs";
import Stash from './handlers/Stash.mjs';
import fs from "fs";
import path from "path";
import Componentry from "@metric-im/componentry";

export default class MetricServer extends Componentry.Module {
    constructor(connector) {
        super(connector,import.meta.url);
        this.refinery = {};
        this.accumulators = {};
    }
    get library() {
        return {
            'chartjs':'/chart.js/dist/chart.js',
            'chartjs-zoom':'/chartjs-plugin-zoom/dist/chartjs-plugin-zoom.js',
            'hammer.min.js':'/hammerjs/hammer.min.js',
            'hammer.min.js.map':'/hammerjs/hammer.min.js.map',
        };
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
        return instance;
    }
    routes() {
        let router = express.Router();
        // set routes services
        router.use('/ping',(new Ping(this.connector)).routes());
        router.use('/pull',(new Pull(this.connector)).routes());
        router.use('/ontology',(new Ontology(this.connector)).routes());
        router.use('/redact',(new Redact(this.connector)).routes());
        router.use('/analysis',(new Analysis(this.connector)).routes());
        // router.use('/stash',(new Stash(this.connector)).routes());
        return router;
    }
}
