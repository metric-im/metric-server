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
        router.all("/*", async (req, res) => {
            try {
                await this.execute(req.account,req.params[0],req.query,res);
            } catch(e) {
                console.error(e);
                return res.status(400).send("error parsing request: "+e.message);
            }
        });
        return router;
    }
    parsePath(path) {
        const parts = path.split('/');
        return {
            format:parts[0],
            namespaces:parts[1]?parts[1].split('.'):[],
            dimensions:parts[2],
            metrics:parts[3]
        }
    }

    /**
     * Runs the given pull request. If path is given as a string, it is
     * parsed into an object including format, namespaces, dimensions and metrics.
     * Execute is meant to be called through the imported API or a web url
     * @param account account object of current user
     * @param dimensions and metrics. If path is a string parse the object structure
     * @param options for filtering and sorting
     * @param the response object should implement status(), send(), json() and sendFile(), like expressjs. If undefined return JSON.
     * @returns {Promise<*>}
     */
    async execute(account,path,options,res) {
        if (typeof path === 'string') path = this.parsePath(path);
        if (typeof account === 'string') account = {id:account};
        let accumulators = {};
        let fieldMap = {};
        for (let ns of path.namespaces) {
            ns = await this.ontology.nameSpace.get(account,ns,1);
            if (!ns) throw(new Error("Namespace unknown"));
            Object.assign(accumulators,await this.ontology.nameSpace.accumulators(account,ns));
            // parse fieldMap from the namespaces requested (usually just one)
            Object.assign(fieldMap,await this.ontology.nameSpace.fields(account,ns));
        }
        // parse dimensions and metrics with DimensionPath helper
        let dp = new DimPath(fieldMap,this.connector);
        try {
            dp.parse(path.dimensions,path.metrics);
        } catch(e) {
            throw(400);
        }

        // Check for stashed results
        let results = null;
        //TODO: get URL: if (options._stash) results = this.stash.get(account,req.url);
        if (!results) {
            // Construct the aggregation query
            let statement = [];
            // build basic match filter
            let namespaceFilter = {_ns:path.namespaces.length===1?path.namespaces[0]:{$in:path.namespaces}};
            statement.push({
                $match: Object.assign(namespaceFilter,
                  Parser.parseTimeFilter(options,"_time"),
                  Parser.objectify(options.where || {})
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

            if (options.sort) statement.push({$sort: Parser.sort(options.sort)});
            // limit can be misleading because of the rearrangement of results.
            if (options.limit) statement.push({$limit: parseInt(options.limit)});
            // Expose the query string to be executed for experimentation and debugging
            if (!!options._inspect) return (res?res.json(statement):statement);
            // Execute the query
            results = await this.collection.aggregate(statement).toArray();
            if (options._stash) this.stash.put(req.account,req.url,results,options._stash);
        }
        // postprocess results
        if (!options._inspect) {
            if (dp.metrics.length > 0 && results.length > 0) results = dp.organize(results);
            if (options.sort) {
                let sort = Parser.sort(options.sort);
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
            if (options.last) results = results.slice(-parseInt(options.last));
            if (options.first) results = results.slice(0,parseInt(options.first));
        }
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
        }
        return results;
    }

    /**
     * Render the json results using one the provider rendering formatters.
     * @param the response object should implement status(), send(), json() and sendFile(), like expressjs     * @param results
     * @param format is an array or string separated by '.'. The first element is the format engine, the following are options interpreted by the engine
     * @returns {Promise<void>}
     */
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
