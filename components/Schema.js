/**
 * Provide field types for events
 */
class Schema {
    constructor(connector) {
        this.connector = connector;
    }
    routes() {
        let router = require('express').Router();
        router.get("/populate/:accountId?/:type?",async(req,res)=>{
            try {
                let result = await this.populate(req.params.accountId,req.params.type);
                res.json(result);
            } catch(e) {
                console.error(`Error populating`,e);
                res.status(500).json({status:'error',message:`Error populating schema data: ${e.message}`});
            }
        });
        router.get("/",async(req,res)=>{
            try {
                let _account = req.session._account || "public"
                await this.populate(_account);
                let result = await this.connector.db.collection('schemas').findOne({_id:_account})
                if (result && result.fields) result.fields.sort((a,b)=>{
                    return (a.name === b.name)?0:(a.name > b.name)?1:-1;
                });
                res.json(result);
            } catch(e) {
                console.error(`Error getting schema`,e);
                res.status(500).json({status:'error',message:`Error getting schema data: ${e.message}`});
            }
        });
        router.put("/",async(req,res)=>{
            try {
                if (!req.session._account) throw new Error("not authorized");
                let result = await this.connector.db.collection('schemas').findOneAndUpdate(
                    {_id:req.session._account},{$set:req.body},{upsert:true}
                );
                res.json(result);
            } catch(e) {
                console.error(`Error putting schema`,e);
                res.status(500).json({status:'error',message:`Error putting schema data: ${e.message}`});
            }
        });
        return router;
    }

    async populate(accounts) {
        let query = [
            {$group:{_id:{accountId:"$accountId",event:"$_type"}}},
            {$lookup:{
                from:"events",
                let:{a:"$_id.accountId",e:"$_id.event"},
                as:"data",
                pipeline:[
                    {$match:{$expr:{$and:[{$eq:["$accountId","$$a"]},{$eq:["$_type","$$e"]}]}}},
                    {$sample:{size:100}},
                    {$project:{_id:0,accountId:"$accountId",event:"$_type","arrayofkeyvalue":{$objectToArray:"$$ROOT"}}},
                    {$unwind:"$arrayofkeyvalue"},
                    {$project:{accountId:1,event:1,field:"$arrayofkeyvalue.k",type:{$type:"$arrayofkeyvalue.v"}}}
                ]}},
            {$unwind:"$data"},
            {$group:{_id:{accountId:"$_id.accountId",field:"$data.field",type:"$data.type"},events:{$addToSet:"$data.event"}}},
            {$group:{_id:"$_id.accountId",fields:{$addToSet:{name:"$_id.field",type:"$_id.type",events:"$events"}}}},
            {$project:{
                _id:1,
                fields:1,
                events:{$reduce:{input:"$fields",initialValue:[],in:{$setUnion:["$$value","$$this.events"]}}},
                _modified:new Date()
            }},
            {$merge:"schemas"}
        ];
        if (accounts) query.unshift({$match:{_id:{$in:accounts.split(',')}}});
        await this.connector.db.collection('events').aggregate(query).toArray();
        return {status:"success",message:"schemas updated"};
    }
    async profile(_account) {
        if (!_account) return {};
        let result = await this.connector.db.collection('schemas').findOne({_id:_account});
        let fields = (result.fields||[]).reduce((r,o)=>{r[o.name]={type:o.type};return r},{});
        fields = (result.derivedFields||[]).reduce((r,o)=>{r[o.name]={
            type:o.type,code:o.code,language:o.language
        };return r},fields);
        return fields;
    }
}
module.exports = Schema;