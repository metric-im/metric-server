/**
 * Pull for events using aggregation
 */
import Parser from './Parser.mjs';
import DimPath from './DimPath.mjs';
import Ontology from './Ontology.mjs';
import express from 'express';
import crypto from "crypto";
export default class Pull {
    constructor(connector,collection='event') {
        this.connector = connector;
        this.collection = this.connector.db.collection(collection);
        this.ontology = new Ontology(connector);
        this.stash = new Stash();
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

                // Check for stashed results
                let results = null;
                if (req.query._stash) results = this.stash.get(req.account,req.url);
                if (!results) {
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
                    // limit can be misleading because of the rearrangement of results.
                    if (req.query.limit) statement.push({$limit: parseInt(req.query.limit)});
                    if (req.query._inspect) return res.json(statement);
                    results = await this.collection.aggregate(statement).toArray();
                    if (req.query._stash) this.stash.put(req.account,req.url,results,req.query._stash);
                }
                // postprocess results
                if (dp.metrics.length > 0 && results.length > 0) results = dp.organize(results);
                if (req.query.sort) {
                    let sort = Parser.sort(req.query.sort);
                    results.sort((a,b)=>{
                        for (let [key,val] of Object.entries(sort)) {
                            if (a[key] === b[key]) continue;
                            else if (a[key === null]) return val;
                            else if (b[key === null]) return -val;
                            else if (a[key] > b[key]) return val;
                            else return -val;
                        }
                        return 0;
                    })
                }
                if (req.query.last) results = results.slice(-parseInt(req.query.last));
                if (req.query.first) results = results.slice(0,parseInt(req.query.first));
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
    async execute(account,ns,context={},path) {
        return {}
    }
}
class Stash {
    constructor() {
        this.stash = {}
        this.janitor = null;
        this.cleanup();
    }
    get(account,url) {
        let stashed = this.stash[this.hashId(account,url)];
        return stashed?stashed.results:null;
    }
    put(account,url,results,expire=60) {
        this.stash[this.hashId(account,url)] = {results:results,expires:Date.now()+(expire*1000)};
    }
    hashId(account,url) {
        return "ID"+crypto.createHash('md5').update(account.id+url).digest('hex');
    }
    cleanup() {
        if (this.janitor) clearTimeout(this.janitor);
        for (let [key,value] of Object.entries(this.stash)) {
            if ((Date.now() - value.expires) > 0) {
                delete this.stash[key]
            }
        }
        this.janitor = setTimeout(this.cleanup.bind(this),2000)
    }
}
