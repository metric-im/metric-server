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
        this.fieldsCollection = this.connector.db.collection('fields');
        this.accountsCollection = this.connector.db.collection('accounts');
    }
    routes() {
        let router = require('express').Router();
        router.use((req,res,next)=>{
            if (req.account && req.account.id) next();
            else res.status(401).send();
        })
        router.get("/populate",async(req,res)=>{
            try {
                let result = await this.populate(req.account.id,req.params.type);
                res.json(result);
            } catch(e) {
                console.error(`Error populating`,e);
                res.status(500).json({status:'error',message:`Error populating ontology data: ${e.message}`});
            }
        });
        router.get('/ns/:name?',async (req,res)=>{
            try {
                return res.json(await this.nameSpace.get(req.account,req.params.name));
            } catch(e) {
                res.status(500).json({status:'error',message:`Error getting namespace: ${e.message}`});
            }
        });
        router.put('/ns/:name/:fields?',async (req,res)=>{
            try {
                req.body._id = req.params.name;
                let result = {};
                if (req.params.fields) result = this.nameSpace.putFields(account,req.params.name,req.params.fields);
                else result = await this.nameSpace.put(req.account,req.body);
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

    async populate(accountId) {
        let query = [
            {$match:{_account:accountId}},
            {$group:{_id:{account:"$_account",event:"$_event"}}},
            {$lookup:{
                from:"events",
                let:{a:"$_id.account",e:"$_id.event"},
                as:"data",
                pipeline:[
                    {$match:{$expr:{$and:[{$eq:["$_account","$$a"]},{$eq:["$_event","$$e"]}]}}},
                    {$sample:{size:100}},
                    {$project:{_id:0,account:"$_account",event:"$_event","arrayofkeyvalue":{$objectToArray:"$$ROOT"}}},
                    {$unwind:"$arrayofkeyvalue"},
                    {$project:{account:1,event:1,field:"$arrayofkeyvalue.k",type:{$type:"$arrayofkeyvalue.v"}}}
                ]}},
            {$unwind:"$data"},
            {$group:{_id:{account:"$_id.account",field:"$data.field",type:"$data.type"},events:{$addToSet:"$data.event"}}},
            {$group:{_id:"$_id.account",fields:{$addToSet:{name:"$_id.field",type:"$_id.type",events:"$events"}}}},
            {$project:{
                _id:1,
                fields:1,
                events:{$reduce:{input:"$fields",initialValue:[],in:{$setUnion:["$$value","$$this.events"]}}},
                _modified:new Date()
            }},
            // {$merge:"ontology"}
        ];
        return await this.connector.db.collection('events').aggregate(query).toArray();
        // return {status:"success",message:"ontology updated"};
    }
    async fieldMap(accountId) {
        if (!accountId) return {};
        let result = await this.connector.db.collection('ontology').findOne({_id:accountId});
        result = result || {}
        let fields = (result.fields||[]).reduce((r,o)=>{r[o.name]={type:o.type};return r},{});
        fields = (result.derivedFields||[]).reduce((r,o)=>{r[o.name]={
            type:o.type,code:o.code,language:o.language
        };return r},fields);
        return fields;
    }
}
module.exports = Ontology;