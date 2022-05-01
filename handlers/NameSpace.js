const Identifier = require("@metric-im/identifier");

/**
 * NameSpace defines a collection of event fields for a domain
 * @type {Data}
 */
class NameSpace {
    constructor(connector) {
        this.connector = connector;
        this.collection = this.connector.db.collection('namespace');
        this.data = this.connector.modules['data-server'];
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
            ns = body;
            if (!(await this.connector.acl.test.owner(
                {account:account.id},{namespace:body._id}
            ))) throw new Error("not authorized");
        }
        return await this.data.put(account,"namespace",ns);
    }
    async get(account,id) {
        let query = [
            {$sort:{_id:1}}
        ];
        if (id) {
            let idExists = await this.connector.acl.test.read({account:account.id},{namespace:id});
            if (idExists) query.unshift({$match:{_id:id}});
            else return [];
            let result = await this.collection.aggregate(query).toArray();
            return result[0];
        } else {
            let ids = await this.connector.acl.get.all({account:account.id},"namespace");
            ids = ids.map(a=>a._id.namespace);
            query.unshift({$match:{$or:[{available:0},{_id:{$in:ids}}]}});
            let result = await this.collection.aggregate(query).toArray();
            return result;
        }
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
                let refiner = new (require('../refinery/'+name))(this.connector);
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
}

module.exports = NameSpace;