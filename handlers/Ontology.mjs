/**
 * The ontology establishes the dimensions, metrics and derived fields
 * that can be employed by an event. Custom ontologies can be defined
 * to accounts. A common ontology is shared across the system.
 */
import NameSpace from "./NameSpace.mjs";
import express from "express";
export default class Ontology {
    constructor(connector) {
        this.connector = connector;
        this.nameSpace = new NameSpace(connector);
    }
    routes() {
        let router = express.Router();
        router.use((req,res,next)=>{
            if (req.account && req.account.id) next();
            else res.status(401).send();
        })
        router.get('/ns/:id?',async (req,res)=>{
            try {
                res.json(await this.nameSpace.get(req.account,req.params.id));
            } catch(e) {
                res.status(500).json({status:'error',message:`Error getting namespace: ${e.message}`});
            }
        });
        router.get('/ns/:id/fields',async (req ,res)=>{
            try {
                res.json(await this.nameSpace.fields(req.account,req.params.id));
            } catch(e) {
                res.status(500).json({status:'error',message:`Error getting namespace: ${e.message}`});
            }
        });
        router.get('/ns/:id/accumulators',async (req,res)=>{
            try {
                res.json(await this.nameSpace.accumulators(req.account,req.params.id));
            } catch(e) {
                res.status(500).json({status:'error',message:`Error getting namespace: ${e.message}`});
            }
        });
        router.put('/ns/:id',async (req,res)=>{
            try {
                req.body._id = req.params.id;
                res.json(await this.nameSpace.put(req.account,req.body));
            } catch(e) {
                res.status(500).json({status:'error',message:`Error putting to namespace: ${e.message}`});
            }
        });
        router.delete('/ns/:id',async (req,res)=>{
            try {
                await this.nameSpace.remove(req.account,req.params.id);
                res.status(204).send();
            } catch(e) {
                res.status(500).json({status:'error',message:`Error deleting namespace: ${e.message}`});
            }
        });
        router.get('/refinery',(req,res)=>{
            let result = Object.keys(NameSpace.refinery).map(key => {
                return {_id:key,description:NameSpace.refinery[key].description}
            })
            res.json(result);
        });
        return router
    }
}
