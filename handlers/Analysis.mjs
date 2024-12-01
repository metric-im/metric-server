/**
 * Provide analysis of the date set for a namespace
 *
 * DEPRECATED use /schema
 */
import Ontology from './Ontology.mjs';
import express from 'express';

export default class Analysis {
    constructor(connector,collection='event') {
        this.connector = connector;
        this.collection = this.connector.db.collection(collection);
        this.ontology = new Ontology(connector);
    }

    routes() {
        let router = express.Router();
        router.use((req,res,next)=>{
            if (req.account && req.account.id) next();
            else res.status(401).send();
        })
        router.get("/:format/:ns", async (req, res) => {
            try {
                let ns = await this.ontology.nameSpace.get(req.account,req.params.ns,2);
                if (!ns) return res.status(401).send();
                let fields = await this.findFields(ns);
                try {
                    let format = req.params.format.split('.');
                    let module = await import('../formatter/'+format[0].toLowerCase()+".mjs");
                    if (!module) res.status(400).json({message:'format unavailable'});
                    let formatter = new module.default(null,format.slice(1));
                    await formatter.render(res,fields);
                } catch(e) {
                    console.error(e);
                    res.status(500).send();
                }
                // if (!fields || fields.length === 0) res.send('no data found')
                // else if (req.params.format==='json') res.json(fields.allkeys);
                // else if (req.params.format === 'raw') res.json(fields);
                // else if (req.params.format === 'table') {
                //     let heads = Object.keys(fields.allkeys[0]).map(k=>`<th>${k}</th>`);
                //     let rows = fields.allkeys.map((f)=>`<tr><td>${}</td><td></td><td></td></tr>`)
                //     res.send(`<html><body><table><tr>${heads}</tr>${rows}</table></body></html>`)
                // } else res.status(400).send('invalid format');
            } catch (e) {
                console.error( e);
                res.status(500).json({status: 'error', message: `Error analysing field data`});
            }
        });
        return router;
    }
    async findFields(ns) {
        let query = [
            {$match:{_ns:ns._id}},
            {$sample:{size:10}},
            {$project:{"arrayofkeyvalue":{$objectToArray:"$$ROOT"}}},
            {$unwind:"$arrayofkeyvalue"},
            {$group:{_id:{name:"$arrayofkeyvalue.k",type:{$type:"$arrayofkeyvalue.v"}},sampleArray:{$addToSet:"$arrayofkeyvalue.v"}}},
            {$set:{sample:{$function:{body:"function(a){return a.join(', ')}",args:["$sampleArray"],lang:"js"}}}},
            {$project:{_id:0,name:"$_id.name",type:"$_id.type",sample:"$sample"}},
            {$sort:{name:1}}
        ];
        return await this.collection.aggregate(query).toArray();
    }
}
