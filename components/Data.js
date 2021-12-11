let Formatter = require('./Formatter');
let Parser = require('./Parser');
let Connector = require('./Connector');

class Data {
    constructor(connector) {
        this.connector = connector;
    }
    routes() {
        let router = require('express').Router();
        router.get('/:collection/:item?',async(req,res)=>{
            try {
                let result = await this.get(req.session.accountId,req.params.collection,req.params.item,req.query);
                res.json(result);
            } catch(e) {
                res.status(e.status||500).json({status:"error",message:e.message});
            }
        });
        router.put('/:collection/:item?',async(req,res)=>{
            try {
                let result = await this.put(req.session.accountId,req.params.collection,req.body,req.params.item);
                res.json(result);
            } catch(e) {
                res.status(e.status||500).json({status:"error",message:e.message});
            }
        });
        router.delete('/:collection/:item',async(req,res)=>{
            try {
                await this.remove(req.session.accountId,req.params.collection,req.params.item);
                res.status(204).send();
            } catch(e) {
                res.status(e.status||500).json({status:"error",message:e.message});
            }
        });
        return router;
    }
    /**
     * Attach the data instance to the request object for downstream use
     */
    attach(req,res,next) {
        req.data = this;
        next();
    }

    /**
     * Query collections in the metric database.
     *
     * When an item id is provided the results are provided as a single
     * object. If not, the results are provided in an array.
     *
     * @param accountId restricts results to the given account.
     * @param collection the name of the collection to collect data from.
     * @param item the id (_id) of the item in the collection. (optional)
     * @param options options to limit, sort or format the results
     * @returns Object
     */
    async get(accountId,collection,item,options={}) {
        let selector = {accountId:accountId};
        if (item) selector._id = item;
        if (options.where) Object.assign(selector,Parser.objectify(options.where));
        let results = await this.connector.dashboard.collection(collection).find(selector).toArray();
        return (item?results[0]:results);
    }

    /**
     * Remove the identified item from the collection. Item must belong to the
     * give accountId
     *
     * @param accountId restricts request to the given account.
     * @param collection the name of the collection in which the item is declared
     * @param item item identifier
     */
    async remove(accountId,collection,item) {
        if (!item) throw new Error('no id provided');
        let selector = {accountId:accountId,_id:item};
        await this.connector.dashboard.collection(collection).deleteOne(selector);
    }

    /**
     * Put an object (or array of objects) into the specified collection.
     * The request is constructed as an upsert. If no item id is provided,
     * one is generated using Connector.makeId()
     *
     * @param accountId enforces writes to the given account.
     * @param collection the name of the collection to collect data from.
     * @param body an object or array of objects
     * @param id can also be provided explicitly in the url if body is a single object
     * @returns Object
     */
    async put(accountId,collection,body,id) {
        if (Array.isArray(body)) {
            if (body.length === 0) throw new Error("Empty data set");
            let writes = [];
            for (let o of body) {
                writes.push({updateOne:{
                    filter:{_id:(o._id||Connector.makeId()),accountId:accountId},
                    update:constructModifier(o),
                    upsert:true
                }});
            }
            let result = await this.connector.dashboard.collection(collection).bulkWrite(writes);
            return {upsertedCount:result.upsertedCount,modifiedCount:result.modifiedCount};
        } else {
            let selector = {_id:body._id||id||Connector.makeId(),accountId:accountId};
            let modifier = constructModifier(body);
            let options = {returnNewDocument:true,upsert:true};
            let result = await this.connector.dashboard.collection(collection).findOneAndUpdate(selector,modifier,options);
            return result.value;
        }

        function constructModifier(doc) {
            let modifier = {$set:{}};
            for (let a in doc) {
                if (['$push','$pull','$addToSet','$unset','$set'].includes(a)) modifier[a] = doc[a];
                else if (!['_id','_created','_createdBy'].includes(a)) modifier.$set[a] = doc[a];
            }
            modifier.$set._modified = new Date();
            modifier.$setOnInsert = {_created:new Date()};
            if (!doc._createdBy) modifier.$setOnInsert._createdBy = "unknown";
            return modifier;
        }
    }
}
module.exports = Data;
