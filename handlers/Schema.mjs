/**
 * Takes a pull request to render a schema of result fields instead of
 * result data. If no dimensions are provided, a sampling of all fields is
 * returned
 */
import Ontology from './Ontology.mjs';
import Pull from './Pull.mjs';
import DimPath from './DimPath.mjs';
import express from 'express';

export default class Schema extends Pull {
    constructor(connector,collection='event') {
        super(connector,collection);
    }
    async execute(account,path,options,res) {
        // run pull in inspect mode to get query statement
        options._inspect = true;
        path = this.parsePath(path);

        let dp = await DimPath.mint(this.connector,account,path);
        let query = [];
        let sampler =
            `function(a){return a.slice(0,3).reduce((r,o)=>{
                if (r.length>0) r += ', ';
                r += (typeof(o)==='string')?o.slice(0,30):o;
                return r; 
            },'')}`
        if (!path.dimensions) {
            query = [{$match:{_ns:{$in:path.namespaces}}}];
        } else {
            query = await super.execute(account,path,options,undefined);
        }
        query.push({$sample:{size:500}});
        query.push({$project:{"arrayofkeyvalue":{$objectToArray:"$$ROOT"}}});
        query.push({$unwind:"$arrayofkeyvalue"});
        query.push({$group:{_id:{name:"$arrayofkeyvalue.k",type:{$type:"$arrayofkeyvalue.v"}},sampleArray:{$addToSet:"$arrayofkeyvalue.v"}}});
        query.push({$set:{sample:{$function:{body:sampler,args:["$sampleArray"],lang:"js"}}}});
        query.push({$project:{_id:0,name:"$_id.name",type:"$_id.type",sample:"$sample"}});
        query.push({$sort:{name:1}});
        let results = await this.collection.aggregate(query).toArray();
        results = results.reduce((r,field)=>{
            if (field.type && field.type !== "null") {
                let o = {name:field.name,type:field.type};
                o.accumulator = dp.fieldMap[field.name]?.accumulator || dp.metrics.find(m=>m.name = field.name)?.method || '';
                o.description = dp.fieldMap[field.name]?.description || '';
                o.sample = field.sample;
                r.push(o);
            }
            return r;
        },[])
        if (res) {
            // Run the selected formatter with the additional strings delimited by dots provided as options
            const format = path.format.split('.');
            let module = await import('../formatter/'+format[0].toLowerCase()+".mjs");
            if (!module) {
                res.status(400).json({message:'format unavailable'});
            } else {
                let formatter = new module.default(dp,format.slice(1));
                // Res should be an object that supports send(), json(), sendFile() and status(), like expressjs
                await formatter.render(res,results);
            }
        } else {
            return results;
        }
    }
}
