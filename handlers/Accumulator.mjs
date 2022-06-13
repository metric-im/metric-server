import path from "path";
import {fileURLToPath} from "url";
import fs from "fs";

export default class Accumulator {
    constructor() {
        this.components = {};
    }

    static async mint(rootPath) {
        let accumulator = new Accumulator()
        let path = rootPath+'/accumulators'
        let components = fs.readdirSync(path);
        for (let comp of components) {
            let name = comp.replace(/(\.mjs|\.js)/,"");
            let module = await import(path + "/" +comp);
            accumulator.components[name] = module.default;
        }
        return accumulator;
    }

    get component() {
        return this.components;
    }
}
