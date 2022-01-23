/**
 * NameSpace defines a collection event fields for a domain
 * @type {Data}
 */
let Data = require('./Data');

class NameSpace {
    constructor(connector) {
        this.connector = connector;
        this.collection = this.connector.db.collection('namespace');
        this.data = new Data(connector);
    }
    template(account,name) {
        return {
            _id:name,
            _pid:"ROOT",
            _account:account.id,
            description:"",
            availability:"private"
        }
    }
    async remove(account,id) {
        await this.data.remove(account.id,"namespace",id);
    }
    async put(account,body) {
        if (!body.created) body = Object.assign(this.template,body);
        let ns = await this.data.put(account.id,"namespace",body);
        return ns;
    }
    async getMine(account) {
        let names = await this.collection.find({_account:account.id}).toArray();
        // create default namespace for account if not already defined
        if (!names.find(o=>(o._id===account.id))) {
            await this.put(account,account.id);
            names = await this.collection.find({_account:account.id}).toArray();
        }
        let accountObj = await this.connector.db.collection('accounts').findOne({_id:account.id});
        let favs = accountObj.nsFavs||[];
        // merge and objectify. Owned namespaces overwrite fav namespaces
        let result = favs.concat(names).reduce((r,o)=>{r[o._id]=o;return r},{});
        result = Object.keys(result).map(k=>result[k]).sort((a,b)=>{
            if (a._id > b._id) return 1;
            else if (a._id < b._id) return -1;
            else return 0;
        });
        return result;
    }
}
module.exports = NameSpace;