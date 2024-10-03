import path from "path";
import {pathToFileURL,fileURLToPath} from "url";
import fs from "fs";

export default class Accumulator {
    constructor() {
        this.components = {};
    }

    static async mint(rootPath) {
        let accumulator = new Accumulator()
        let components = fs.readdirSync(path.resolve(rootPath+"/accumulators"))
        for (let comp of components) {
            let name = comp.replace(/(\.mjs|\.js)/,"");
            let module = await import(pathToFileURL(rootPath+"/accumulators/"+comp));
            accumulator.components[name] = module.default;
        }
        return accumulator;
    }

    get component() {
        return this.components;
    }
}
