/**
 * NameSpace defines a collection of event fields for a domain
 * @type {Data}
 */
let _refineryModules = {};
export default class NameSpace {
    constructor(connector) {
        this.connector = connector;
        this.collection = this.connector.db.collection('namespace');
        this.data = this.connector.modules.DataServer;
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
        await this.data.remove(account,"namespace",id);
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
            ))) return null
        }
        return await this.data.put(account,"namespace",ns);
    }
    async get(account,id,level=1) {
        let query = [{$sort:{_id:1}}];
        if (id) {
            let access = await this.connector.acl.test[this.accessLevels[level]]({account: account.id}, {namespace: id});
            if (!access && account.super !== true) {
                let ns = await this.collection.findOne({_id:id});
                if (!ns || ns.availability !== "public") return null;
            }
            query.unshift({$match: {_id: id}});
        } else {
            let ids = await this.connector.acl.get[this.accessLevels[level]]({account:account.id},"namespace");
            ids = ids.map(a=>a._id.namespace);
            query.unshift({$match:{_id:{$in:ids}}});
        }
        let result = await this.collection.aggregate(query).toArray();
        return id?result[0]:result;
    }
    async fields(account,id) {
        let ancestry = [];
        let map = {};
        while (id) {
            let ns = await this.collection.findOne({_id:id});
            if (!ns) break;
            ancestry.push(ns);
            id = ns._pid===id?null:ns._pid;
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
        return map;
    }
    // populated when the server is minted
    static refinery = {};
}
