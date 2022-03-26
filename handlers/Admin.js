let express = require('express');

class Admin {
    constructor() {
        this.MongoClient = require('mongodb').MongoClient;
        this.db = this.MongoClient.connect("mongodb://localhost:27017/metric",{useNewUrlParser:true,useUnifiedTopology:true});
    }
    routes() {
        let router = express.Router();
        router.all("/data/*",async(req,res)=>{
            try {
                let result = await this.data[req.method](req.path.slice(5),req.query);
                res.json(result);
            } catch(e) {
                console.error(`Error invoking ${req.method} on data`,e);
                res.status(500).send(`Error invoking ${req.method} on data: ${e.message}`);
            }
        });
        return router;
    }
    get data() {
        return {
            GET:this._get.bind(this),
            PUT:this._put.bind(this)
        }
    }
    async _get(path,options={}) {
        let parts = path.split('/');
        if (parts[0]==="") parts.shift();
        let collection = parts[0];
        let entityId = parts[1];
        return {collection:collection,id:entityId};
    }
    async _put(path,options={}) {
        let parts = path.split('/');
        let collection = parts[0];
        let entityId = parts[1];
        return {collection:collection,id:entityId};
    }
}

module.exports = Admin;