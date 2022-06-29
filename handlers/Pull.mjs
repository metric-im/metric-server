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
                let {namespaces,dimensions,metrics} = req.params;
                namespaces = req.params.ns.split(',');
                let accumulators = {};
                let fieldMap = {};
                for (let ns of namespaces) {
                    ns = await this.ontology.nameSpace.get(req.account,ns,1);
                    if (!ns) return res.status(401).send();
                    Object.assign(accumulators,await this.ontology.nameSpace.accumulators(req.account,ns));
                    // parse fieldMap from the namespaces requested (usually just one)
                    Object.assign(fieldMap,await this.ontology.nameSpace.fields(req.account,ns));
                }
                // parse dimensions and metrics with DimensionPath helper
                let dp = new DimPath(fieldMap,this.connector);
                try {
                    dp.parse(dimensions,metrics);
                } catch(e) {
                    return res.status(400).send('malformed request');
                }

                // Construct the aggregation query
                let statement = [];
                // build basic match filter
                let namespaceFilter = {_ns:namespaces.length===1?namespaces[0]:{$in:namespaces}};
                statement.push({
                    $match: Object.assign(namespaceFilter,
                        Parser.parseTimeFilter(req.query,"_time"),
                        Parser.objectify(req.query.where || {})
                    )
                });
                // add derived fields
                statement = statement.concat(dp.expandDerivedFields());

                // add any filters built into the dimensions request
                if (Object.keys(dp.filters).length > 0) statement.push({$match:dp.filters});
                // group by metrics
                let group = {_id: {}};
                let project = {_id: 0, '_ns': '$_id._ns'};
                for (let dimension of dp.dimensions) {
                    if (dimension.compressor === dp._SKIP) continue;
                    group._id[dimension.name] = `$${dimension.name}`
                    project[dimension.name] = '$_id.' + dimension.name;
                }
                for (let metric of dp.metrics) {
                    if (metric.name === '_count') {
                        // builtin method for aggregating result count, result is displayed as _count;
                        group[metric.name] = {['$sum']: 1};
                        project[metric.name] = 1;
                        continue;
                    }
                    // an undefined accumulator is assumed to be mongo native
                    if (!accumulators[metric.method]) {
                        group[metric.name] = {['$' + metric.method]: '$' + metric.name};
                    } else {
                        let accumulator = new accumulators[metric.method](metric.name);
                        Object.assign(group,accumulator.$accumulator(...metric.methodArgs));
                    }
                    project[metric.name] = 1;
                }
                statement.push({$group: group});
                statement.push({$project: project});
                // add/overwrite fields with projection code
                statement = statement.concat(dp.expandProjectedFields());

                for (let metric of dp.metrics) {
                    if (accumulators[metric.method]) {
                        let accumulator = new accumulators[metric.method](metric.name);
                        let window = accumulator.$setWindowFields(...metric.methodArgs);
                        if (!window) continue;
                        if (!Array.isArray(window)) window = [window];
                        statement = statement.concat(window);
                    }
                }

                if (req.query.sort) statement.push({$sort: Parser.sort(req.query.sort)});
                if (req.query.limit) statement.push({$limit: parseInt(req.query.limit)})
                if (req.query._inspect) return res.json(statement);
                let results = await this.collection.aggregate(statement).toArray();
                // postprocess results
                if (dp.metrics.length > 0 && results.length > 0) results = dp.organize(results);
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
