const Identifier = require("@metric-im/identifier");

/**
 * NameSpace defines a collection event fields for a domain
 * @type {Data}
 */
class NameSpace {
    constructor(connector) {
        this.connector = connector;
        this.collection = this.connector.db.collection('namespace');
        this.collection = this.connector.db.collection('namespace');
        this.data = new (require('./Data'))(connector);
    }
    get template() {
        return {
            ns: (account,name)=>{
                return {
                    _id: name,
                    _pid: "ROOT",
                    acl:{[account.id]:3},
                    description: "",
                    availability: "private"
                }
            },
            field: (ns,name)=>{
                return {
                    _id: name,
                    _ns: ns,
                    datatype:"string",
                    description: ""
                }
            }
        }
    }
    async remove(account,id) {
        if (!(await this.test.owner(account,id))) throw new Error("not authorized");
        await this.data.remove(account.id,"namespace",id);
    }
    async put(account,body) {
        if (!body || !body._id) throw new Error('Namespace requires an identifier');
        let acl = await this.connector.get()
        if (!(await this.connector.test.owner(
            {accounts:account.id},{namespace:body._id}
        ))) throw new Error("not authorized");

        let ns = await this.collection.findOne({_id:body._id});
        if (!ns) ns = Object.assign(this.template.ns(account),body);
        if (!account.acl.namespace || !account.acl.namespace.find(a=>ns._id)) throw new Error('Not Authorized');
        delete ns.fields; // use putFields
        return await this.data.put(account.id,"namespace",body);
    }
    async get(account,id) {
        let query = [
            {$lookup:{from:"fields",localField:"_id",foreignField:"_ns",as:"fields"}},
            {$sort:{_id:1}}
        ];
        if (id) {
            let idExists = await this.connector.test.read({accounts:account.id},{namespace:id});
            if (idExists) query.unshift({$match:{_id:id}});
            else return [];
            let result = await this.collection.aggregate(query).toArray();
            return result[0];
        } else {
            let ids = await this.connector.acl.get.all({accounts:account.id},"namespace");
            ids = ids.map(a=>a.namespace);
            query.unshift({$match:{$or:[{available:0},{_id:{$in:ids}}]}});
            let result = await this.collection.aggregate(query).toArray();
            return result;
        }
    }
    async putFields(account,ns,fields=[]) {
        if (!(await this.test.write(account,ns))) throw new Error("not authorized");
        if (!Array.isArray(fields)) fields = [fields];
        fields = fields.map(field=>Object.assign(field,{_ns:ns}));
        return await this.data.put(account.id,"fields",fields);
    }
}

module.exports = NameSpace;