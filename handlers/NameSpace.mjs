import fs from "fs";
import path from "path";

/**
 * NameSpace defines a collection of event fields for a domain
 * @type {Data}
 */
export default class NameSpace {
    constructor(connector) {
        this.connector = connector;
        this.collection = this.connector.db.collection('namespace');
        this.accessLevels = ['all','read','write','owner'];
    }
    get template() {
        return {
            ns: (account,name)=>{
                return {
                    _id: name,
                    _pid: "root",
                    description: "",
                    availability: "private"
                }
            },
        }
    }
    async remove(account,id) {
        if (!(await this.connector.acl.test.owner({account:account.id},{namespace:id}))) throw new Error("not authorized");
        await this.connector.componentry.modules.DataServer.remove(account,"namespace",id);
    }
    async put(account,body) {
        if (!body || !body._id) throw new Error('Namespace requires an identifier');
        let ns = await this.collection.findOne({_id:body._id});
        if (!ns) {
            ns = Object.assign(this.template.ns(account),body);
            await this.connector.acl.assign.owner({account:account.id},{namespace:body._id});
        } else {
            Object.assign(ns,body);
            if (!(await this.connector.acl.test.write(
                {account:account.id},{namespace:body._id}
            ))) throw new Error("unauthorized");
        }
        return await this.connector.componentry.modules.DataServer.put(account,"namespace",ns);
    }
    async get(account,id,level=1) {
        let query = [{$sort:{_id:1}}];
        if (id) {
            let result = await this.collection.findOne({_id:id})
            let access = await this.connector.acl.test[this.accessLevels[level]]({account: account?.id}, {namespace: id});
            if (!access && account?.super !== true) {
                if (!result || result.availability !== "public") return null;
            }
            if (result?.refinery) {
                let available = {};
                // Remove refiners that are referenced but not available
                result.refinery = result.refinery.filter(a=>NameSpace.refinery[a]);
                result.refinery.sort((a,b)=>{
                    a = NameSpace.refinery[a];
                    b = NameSpace.refinery[b];
                    for (let requiredField of a.requires) {
                        for (let providedField of b.provides) {
                            if (requiredField === providedField._id) return 1;
                        }
                    }
                    for (let requiredField of b.requires) {
                        for (let providedField of a.provides) {
                            if (requiredField === providedField._id) return -1;
                        }
                    }
                    return 0;
                })
            }
            return result;
        } else {
            let ids = await this.connector.acl.get[this.accessLevels[level]]({account:account?.id},"namespace");
            ids = ids.map(a=>a._id.namespace);
            return await this.collection.find({_id:{$in:ids}}).sort({_id:1}).toArray();
        }
    }
    async fields(account,ns) {
        let ancestry = [];
        let map = {};
        while (ns) {
            if (typeof ns === 'string') {
                ns = await this.collection.findOne({_id:ns});
                if (!ns) break;
            }
            ancestry.push(ns);
            ns = ns._pid===ns._id?null:ns._pid;
        }
        for (let source of ancestry) {
            for (let name of source.refinery||[]) {
                let refiner = NameSpace.refinery[name];
                if (refiner) {
                    Object.assign(map,refiner.provides.reduce((r,o)=>{
                        r[o._id] = o;
                        return r;
                    },{}));
                }
            }
            Object.assign(map,source.fields.reduce((r,o)=>{
                r[o._id] = o;
                return r;
            },{}));
        }
        map = Object.keys(map).sort().reduce((r,key)=>{
            r[key] = map[key];
            return r;
        },{})
        return map;
    }
    async accumulators(account,ns) {
        let map = {sum:null,avg:null,max:null,min:null,first:null,last:null,addToSet:null,stdDevPop:null,stdDevSamp:null};
        while (ns) {
            if (typeof ns === 'string') {
                ns = await this.collection.findOne({_id:ns});
                if (!ns) break;
            }
            for (let [name,value] of Object.entries(NameSpace.Accumulator.components)) {
                if (value.scope === ns._id) map[name] = value;
            }
            ns = ns._pid===ns._id?null:ns._pid;
        }
        return map;
    }
    static async loadRefinery() {
        let refiners = fs.readdirSync(path.resolve(instance.rootPath+"/refinery"));
        for (let file of refiners) {
            let Refiner = await import('./refinery/'+file);
            let name = file.replace(/(\.mjs|\.js)/,"");
            instance.refinery[name] = new Refiner.default(connector);
        }
        return this._refinery;
    }
    static refinery = {};
    static Accumulator = {};
}
