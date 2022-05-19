import express from 'express';
import Ping from './handlers/Ping.mjs';
import Pull from './handlers/Pull.mjs';
import Ontology from './handlers/Ontology.mjs';
import NameSpace from './handlers/NameSpace.mjs';
import Redact from './handlers/Redact.mjs';
import fs from "fs";
import path from "path";
import {fileURLToPath} from "url";
export default class MetricServer {
    constructor(connector) {
        this.connector = connector;
        this.rootPath = path.dirname(fileURLToPath(import.meta.url));
        this.refinery = {};
    }
    static async mint(connector) {
        let instance = new MetricServer(connector);
        let files = fs.readdirSync(instance.rootPath+"/refinery");
        for (let file of files) {
            let Refiner = await import('./refinery/'+file);
            let name = file.replace(/(\.mjs|\.js)/,"");
            instance.refinery[name] = new Refiner.default(connector);
        }
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
        return router;
    }
}
