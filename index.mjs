import express from 'express';
import Ping from './handlers/Ping.mjs';
import Pull from './handlers/Pull.mjs';
import Ontology from './handlers/Ontology.mjs';
import NameSpace from './handlers/NameSpace.mjs';
import Redact from './handlers/Redact.mjs';
import Analysis from './handlers/Analysis.mjs';
import Stash from './handlers/Stash.mjs';
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
export default class MetricServer {
    constructor(connector) {
        this.connector = connector;
        this.rootPath = path.dirname(fileURLToPath(import.meta.url));
        this.refinery = {};
        this.accumulators = {};
        this.library = {
            'chartjs':this.rootPath+'/node_modules/chart.js/dist/chart.js',
            'chartjs-zoom':this.rootPath+'/node_modules/chartjs-plugin-zoom/dist/chartjs-plugin-zoom.js'
        };
    }
    static async mint(connector) {
        let instance = new MetricServer(connector);
        let refiners = fs.readdirSync(instance.rootPath+"/refinery");
        for (let file of refiners) {
            let Refiner = await import('./refinery/'+file);
            let name = file.replace(/(\.mjs|\.js)/,"");
            instance.refinery[name] = new Refiner.default(connector);
        }
        let accumulators = fs.readdirSync(instance.rootPath+"/accumulators");
        for (let file of accumulators) {
            let Accumulator = await import('./accumulators/'+file);
            for (let key of Object.keys(Accumulator.default.functions)) {
                Accumulator.default.functions[key] = Accumulator.default.functions[key].toString();
            }
            instance.accumulators[Accumulator.default.name] = Accumulator.default;
        }
        NameSpace.refinery = instance.refinery;
        NameSpace.accumulators = instance.accumulators;
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
