/**
 * The ontology establishes the dimensions, metrics and derived fields
 * that can be employed by an event. Custom ontologies can be defined
 * to accounts. A common ontology is shared across the system.
 */
let NameSpace = require('./NameSpace');
class Ontology {
    constructor(connector) {
        this.connector = connector;
        this.nameSpace = new NameSpace(connector);
        this.accountCollection = this.connector.db.collection('account');
    }
    routes() {
        let router = require('express').Router();
        router.use((req,res,next)=>{
            if (req.account && req.account.id) next();
            else res.status(401).send();
        })
        router.get('/ns/:name?',async (req,res)=>{
            try {
                return res.json(await this.nameSpace.get(req.account,req.params.name));
            } catch(e) {
                res.status(500).json({status:'error',message:`Error getting namespace: ${e.message}`});
            }
        });
        router.get('/ns/:name/fields',async (req,res)=>{
            try {
                return res.json(await this.nameSpace.fields(req.account,req.params.name));
            } catch(e) {
                res.status(500).json({status:'error',message:`Error getting namespace: ${e.message}`});
            }
        });
        router.put('/ns/:name',async (req,res)=>{
            try {
                req.body._id = req.params.name;
                let result = await this.nameSpace.put(req.account,req.body);
                res.json(result);
            } catch(e) {
                res.status(500).json({status:'error',message:`Error putting to namespace: ${e.message}`});
            }
        });
        router.delete('/ns/:name',async (req,res)=>{
            try {
                await this.nameSpace.remove(req.account,req.params.name);
                res.json({status:'success'});
            } catch(e) {
                res.status(500).json({status:'error',message:`Error deleting namespace: ${e.message}`});
            }
        });
        return router
    }

}
module.exports = Ontology;