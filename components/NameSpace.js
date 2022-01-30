const Identifier = require("@metric-im/identifier");

/**
 * NameSpace defines a collection of event fields for a domain
 * @type {Data}
 */
class NameSpace {
    constructor(connector) {
        this.connector = connector;
        this.collection = this.connector.db.collection('namespace');
        this.fieldCollection = this.connector.db.collection('field');
        this.data = new (require('./Data'))(connector);
    }
    get template() {
        return {
            ns: (account,name)=>{
                return {
                    _id: name,
                    _pid: "ROOT",
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
        await this.data.remove(account,"namespace",id);
    }
    async put(account,body) {
        if (!body || !body._id) throw new Error('Namespace requires an identifier');
        let ns = await this.collection.findOne({_id:body._id});
        if (!ns) {
            ns = Object.assign(this.template.ns(account),body);
            await this.connector.acl.assign.owner({account:account.id},{namespace:body._id});
        } else {
            if (!(await this.connector.acl.test.owner(
                {account:account.id},{namespace:body._id}
            ))) throw new Error("not authorized");
        }

        delete ns.fields; // use putFields
        return await this.data.put(account,"namespace",body);
    }
    async get(account,id) {
        let query = [
            {$lookup:{from:"field",localField:"_id",foreignField:"_ns",as:"fields"}},
            {$sort:{_id:1}}
        ];
        if (id) {
            let idExists = await this.connector.test.read({account:account.id},{namespace:id});
            if (idExists) query.unshift({$match:{_id:id}});
            else return [];
            let result = await this.collection.aggregate(query).toArray();
            return result[0];
        } else {
            let ids = await this.connector.acl.get.all({account:account.id},"namespace");
            ids = ids.map(a=>a.namespace);
            query.unshift({$match:{$or:[{available:0},{_id:{$in:ids}}]}});
            let result = await this.collection.aggregate(query).toArray();
            return result;
        }
    }
    async putFields(account,ns,fields=[]) {
        if (!fields || fields.length===0) return ({status:'warning',message:'empty field set'});
        if (!(await this.connector.acl.test.write({account:account.id},{namespace:ns}))) throw new Error("not authorized");
        if (!Array.isArray(fields)) fields = [fields];
        fields = fields.map(field=>Object.assign(field,{_ns:ns}));
        return await this.data.put(account,"field",fields);
    }
}

module.exports = NameSpace;