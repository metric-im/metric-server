/**
 * Pull for events using aggregation
 */
import Parser from './Parser.mjs';
import DimPath from './DimPath.mjs';
import Ontology from './Ontology.mjs';
import express from 'express';
export default class Pull {
    constructor(connector) {
        this.connector = connector;
        this.collection = this.connector.db.collection('event');
        this.ontology = new Ontology(connector);
    }

    routes() {
        let router = express.Router();
        router.use((req,res,next)=>{
            if (req.account && req.account.id) next();
            else res.status(401).send();
        });
        router.all("/:format/:ns/:dimensions/:metrics", async (req, res) => {
            try {
                // load namespaces
                let namespaces = req.params.ns.split(',');
                let accumulators = {};
                for (let i=0;i<namespaces.length;i++) {
                    namespaces[i] = await this.ontology.nameSpace.get(req.account,namespaces[i],1);
                    if (!namespaces[i]) return res.status(401).send();
                    Object.assign(accumulators,await this.ontology.nameSpace.accumulators(req.account,namespaces[i]))
                }
                let {dimensions,metrics} = req.params;
                // parse fieldMap from the namespaces requested (usually just one)
                let fieldMap = {};
                for (let ns of namespaces) {
                    Object.assign(fieldMap,await this.ontology.nameSpace.fields(req.account,ns));
                }
                // parse metrics into input field(s) and method. Sum is default if method is not provided
                if (metrics) {
                    if (typeof metrics === 'string') metrics = metrics.split(',');
                    metrics = metrics.map(m => {
                        let parts = m.split(':');
                        let name = parts[0].startsWith('(')?parts[0].slice(1,-1).split(','):[parts[0]];
                        let method = parts[1]?parts[1]:(fieldMap[name]?fieldMap[name].accumulator:'sum');
                        return {name: name, method: method}
                    });
                } else metrics = [];
                // parse dimensions with DimensionPath helper
                let dp = new DimPath(fieldMap,this.connector);
                try {
                    dp.parse(dimensions,metrics);
                } catch(e) {
                    res.status(400).send('malformed request');
                }

                // Construct the aggregation query
                let statement = [];
                // build basic match filter
                let namespaceFilter = {_ns:{$in:namespaces.map(ns=>ns._id)}};
                statement.push({
                    $match: Object.assign(namespaceFilter,
                        Parser.parseTimeFilter(req.query,"_time"),
                        Parser.objectify(req.query.where || {})
                    )
                });
                // add derived fields
                let fieldNames = dp.dimensions.map(d=>d.name).concat(metrics.map(d=>d.name)).flat();
                statement.push({$addFields:Object.keys(fieldMap).reduce((r,k)=>{
                    if (fieldMap[k].derived && fieldNames.includes(k)) {
                        try {
                            if (fieldMap[k].interpreter==='json') {
                                r[k] = Parser.objectify(fieldMap[k].code);
                            } else if (!fieldMap[k].interpreter || fieldMap[k].interpreter==='javascript') {
                                let inputs = fieldMap[k].code.match(/^function(?:\W*?)\((.*)\)/);
                                if (inputs) {
                                    inputs = inputs[1].split(',').reduce((r,a)=>{
                                        if (a) r.push('$'+a);
                                        return r;
                                    },[]);
                                    r[k] = {$function:{body:fieldMap[k].code, args:inputs, lang:"js"}}
                                }
                            }
                        } catch(e) {
                            throw new Error(`Could not parse derived field ${k}, ${e.message}`);
                        }
                    }
                    return r;
                },{})});
                // add any filters built into the dimensions request
                if (Object.keys(dp.filters).length > 0) statement.push({$match:dp.filters});
                // group by metrics if provided
                if (metrics.length > 0) {
                    let group = {_id: {}};
                    let project = {_id: 0, '_ns': '$_id._ns'};
                    for (let dim of dp.dimensions) {
                        if (dim.compressor === dp._SKIP) continue;
                        group._id[dim.name] = `$${dim.name}`
                        project[dim.name] = '$_id.' + dim.name;
                    }
                    for (let metric of metrics) {
                        if (metric.name[0] === '_count') {
                            // builtin method for aggregating result count, result is display as _count;
                            group[metric.name] = {['$sum']: 1};
                            project[metric.name] = 1;
                            continue;
                        }
                        // an accumulator with no code is mongo native
                        if (!accumulators[metric.method]) {
                            // no scenario for multiple inputs to system accumulators has been devised
                            group[metric.name] = {['$' + metric.method]: '$' + metric.name[0]};
                        } else {
                            let resultName = (Array.isArray(metric.name))?metric.name.join('.'):metric.name;
                            let properties = Object.assign(
                                {lang:"js",accumulateArgs:metric.name.map(a=>'$'+a)},
                                accumulators[metric.method].functions
                            );
                            group[resultName] = {$accumulator:properties}
                        }
                        project[metric.name] = 1;
                    }
                    statement.push({$group: group});
                    statement.push({$project: project});
                }
                if (req.query.sort) statement.push({$sort: Parser.sort(req.query.sort)});
                if (req.query.limit) statement.push({$limit: parseInt(req.query.limit)})
                if (req.query._inspect) return res.json(statement);
                let results = await this.collection.aggregate(statement).toArray();
                // postprocess results
                if (metrics.length > 0 && results.length > 0) results = dp.organize(results);
                let format = req.params.format.split('.');
                let module = await import('../formatter/'+format[0].toLowerCase()+".mjs");
                if (!module) res.status(400).json({message:'format unavailable'});
                let formatter = new module.default(dp,format.slice(1));
                await formatter.render(res,results);
            } catch(e) {
                console.error(e);
                return res.status(400).send("error parsing request: "+e.message);
            }
        });
        return router;
    }
}
