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
        if (!(await this.test(account,id).owner)) throw new Error("not authorized");
        await this.data.remove(account.id,"namespace",id);
    }
    async put(account,body) {
        if (!body || !body._id) throw new Error('Namespace requires an identifier');
        let ns = await this.data.get(account.id,"namespace",body._id);
        if (!ns) ns = Object.assign(this.template.ns(account),body);
        if (!(await this.test(account,ns).owner)) throw new Error("not authorized");
        return await this.data.put(account.id,"namespace",body);
    }
    async get(account,id) {
        let match = {['acl.'+account.id]:{$gt:0}};
        if (id) match._id = id;
        let query = [
            {$match:match},
            {$lookup:{from:"fields",localField:"_id",foreignField:"_ns",as:"fields"}},
            {$sort:{_id:1}}
        ];
        return await this.collection.aggregate(query).toArray();
    }
    async putFields(account,ns,fields=[]) {
        if (!(await this.test(account,ns).write)) throw new Error("not authorized");
        if (!Array.isArray(fields)) fields = [fields];
        fields = fields.map(field=>Object.assign(field,{_ns:ns}));
        return await this.data.put(account.id,"fields",fields);
    }
    async test(account,ns) {
        if (typeof ns === 'string') ns = await this.collection.findOne({_id:ns});
        let acl = ns.acl.find(acl=>acl.id===account.id);
        return {
            get read() {return acl.value>0},
            get write() {return acl.value>1},
            get owner() {return acl.value>2},
        }
    }
}

module.exports = NameSpace;