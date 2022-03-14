const Parser = require('./Parser');
const DimPath = require("./DimPath");

/**
 * Pull for events using aggregation
 */
class Pull {
    constructor(connector) {
        this.connector = connector;
        this.collection = this.connector.db.collection('event');
        this.ontology = new (require('./Ontology'))(connector);
    }

    routes() {
        let router = require('express').Router();
        router.use((req,res,next)=>{
            if (req.account && req.account.id) next();
            else res.status(401).send();
        });
        router.all("/:format/:ns/:dimensions/:metrics?", async (req, res) => {
            let {dimensions,metrics} = req.params;
            if (dimensions[0]==="*") dimensions = "";
            // parse metrics into name and method. Sum is default if method is not provided
            if (metrics) {
                if (typeof metrics === 'string') metrics = metrics.split(',');
                metrics = metrics.map(m => {
                    let parts = m.split(':');
                    return {name: parts[0], method: parts[1] || 'sum'}
                });
            } else metrics = [];
            // parse dimensions
            let fieldMap = await this.ontology.fieldMap(req._account);
            let dp = new DimPath(fieldMap,req.query.sort);
            dp.parse(dimensions,metrics);

            let statement = [];
            // build basic match filter
            let namespace = {}
            if (req.params.ns && req.params.ns !== '*' ) {
                let parts = req.params.ns.split(',');
                if (parts.length > 1) namespace._ns={$in:parts};
                else namespace._ns = parts[0]
            }
            statement.push({
                $match: Object.assign(namespace,
                Parser.parseTimeFilter(req.query,"_time"),
                Parser.objectify(req.query.where || {})
            )});
            // add derived fields
            let fieldNames = dp.dimensions.map(d=>d.name).concat(metrics.map(d=>d.name));
            statement.push({$addFields:Object.keys(fieldMap).reduce((r,k)=>{
                if (fieldMap[k].code && fieldNames.includes(k)) {
                    try {
                        if (fieldMap[k].language==='json') {
                            r[k] = Parser.objectify(ontology[k].code);
                        } else if (fieldMap[k].language==='js') {
                            let inputs = fieldMap[k].code.match(/^function\((.*)\)/);
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
            // add dimension filter
            if (Object.keys(dp.filters).length > 0) statement.push({$match:dp.filters});
            // group metrics if provided
            if (metrics.length > 0) {
                let group = {_id: {}};
                let project = {_id: 0, '_ns': '$_id._ns'};
                for (let dim of dp.dimensions) {
                    if (dim.compressor === dp._SKIP) continue;
                    group._id[dim.name] = `$${dim.name}`
                    project[dim.name] = '$_id.' + dim.name;
                }
                for (let metric of metrics) {
                    if (metric.name === '_count') {
                        // builtin method for aggregating result count, result is display as _count;
                        group[metric.name] = {['$sum']: 1};
                        project[metric.name] = 1;
                        continue;
                    }
                    let method = metric.method;
                    if (method === 'ratio') method = 'sum'; // see post processing for ratio calculation
                    group[metric.name] = {['$' + method]: '$' + metric.name};
                    project[metric.name] = 1;
                }
                statement.push({$group: group});
                statement.push({$project: project});
                if (req.query.sort) statement.push({$sort: Parser.sort(req.query.sort)});
                if (req.query.limit) statement.push({$limit: parseInt(req.query.limit)})
            }
            if (req.query._inspect) return res.json(statement);
            let results = await this.collection.aggregate(statement).toArray();
            // postprocess results
            if (metrics.length > 0 && results.length > 0) {
                results = dp.organize(results);
                for (let metric of metrics) {
                    if (metric.method==='ratio') processRatio(metric,results);
                }
            }
            try {
                let format = req.params.format.split('.');
                let module = require('../formatter/'+format[0].toLowerCase()+".js");
                if (!module) res.status(400).json({message:'format unavailable'});
                let formatter = new module(dp,format.slice(1));
                await formatter.render(res,results);
            } catch(e) {
                console.error(e);
                res.status(500).send();
            }
        });
        return router;
    }
}
function processRatio(metric,results) {
    if (results[0][metric.name]) {
        let sum=0;
        for (let record of results) {
            sum += record[metric.name];
        }
        for (let record of results) {
            record[metric.name] = Math.round((record[metric.name] / sum)*1000)/10;
        }
    } else {
        for (let record of results) {
            for (let key in record) {
                if (typeof record[key] === 'object') {
                    processRatio(metric,Object.keys(record[key]).map(k=>record[key][k]));
                }
            }
        }
    }
}

module.exports = Pull;
