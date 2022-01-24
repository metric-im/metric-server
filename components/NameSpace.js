const Identifier = require("@metric-im/identifier");

/**
 * NameSpace defines a collection event fields for a domain
 * @type {Data}
 */
class NameSpace {
    constructor(connector) {
        this.connector = connector;
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
        let ns = await this.collection.findOne({_id:body._id});
        if (!ns) ns = Object.assign(this.template.ns(account),body);
        if (!(await this.test.owner(account,ns))) throw new Error("not authorized");
        delete ns.fields; // use putFields
        return await this.data.put(account.id,"namespace",body);
    }
    async get(account,id) {
        let match = {['acl.'+account.id]:{$gt:0}};
        if (id) match._ns = id;
        let query = [
            {$match:match},
            {$lookup:{from:"fields",localField:"_id",foreignField:"_ns",as:"fields"}},
            {$sort:{_id:1}}
        ];
        return await this.collection.aggregate(query).toArray();
    }
    async putFields(account,ns,fields=[]) {
        if (!(await this.test.write(account,ns))) throw new Error("not authorized");
        if (!Array.isArray(fields)) fields = [fields];
        fields = fields.map(field=>Object.assign(field,{_ns:ns}));
        return await this.data.put(account.id,"fields",fields);
    }
    get test() {
        return {
            read:async (account,ns)=>{return await base(account,ns) > 0},
            write:async (account,ns)=>{return await base(account,ns) > 1},
            owner:async (account,ns)=>{return await base(account,ns) > 2}
        }
        async function base(account,ns) {
            if (typeof ns === 'string') ns = await this.collection.findOne({_id:ns});
            return ns.acl[account.id];
        }
    }
}

module.exports = NameSpace;