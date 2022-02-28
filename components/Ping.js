let Parser = require('./Parser');
let Id = require('@metric-im/identifier');
const DimPath = require("./DimPath");
const pixel = new Buffer.from('R0lGODlhAQABAJAAAP8AAAAAACH5BAUQAAAALAAAAAABAAEAAAICBAEAOw==','base64');

/**
 * Record an event. This route is public with a few caveats:
 * * Only validated sessions can record `_account`, otherwise default is "public"
 * * The first path parameter is recorded as _event. If not provide "ping" is the default
 * * `_time` is always written by the system in UTC
 * * date (YYYY/MM/DD string), year, month, day, hour, minute and week are reserved and calculated
 *
 * All data sent via query string is recorded as strings. Use PUT method to provide specific
 * attribute types in the body via Json.
 */
class Ping {
    constructor(connector) {
        this.connector = connector;
        this.collection = this.connector.db.collection('event');
        this.fieldCollection = this.connector.db.collection('field');
        this.ontology = new (require('./Ontology'))(connector);
        this.transformers = {};
        for (let name of ['LocationFromIP','Holiday','Weather']) {
            this.transformers[name] = new (require('../transformers/'+name))(connector);
        }
    }

    routes() {
        let router = require('express').Router();
        router.use((req,res,next)=>{
            if (req.account && req.account.id) next();
            else res.status(401).send();
        })
        router.all("/:event?", async (req, res) => {
            try {
                // let fieldMap = await this.ontology.fieldMap(req._account);
                // let dp = new DimPath(fieldMap);
                // let parsedQuery = Object.keys(req.query).reduce((r,k)=>{
                //     r[k] = dp.parseValue(k,req.query[k]);
                //     return r;
                // },{});
                let context = Object.assign({
                    hostname:req.hostname,
                    url:req.url,
                    ip:req.ip,
                    ua:req.headers['User-Agent']
                },req.body._origin);
                if (req.body._origin) delete req.body._origin;
                if (this.connector.profile.profile==="DEV" && context.ip === '::1') context.ip = '208.157.149.67';
                let parsedQuery = await this.castFields(req.query);
                let parsedBody = await this.castFields(req.body)
                let body = Object.assign({},
                    parsedBody,
                    parsedQuery,
                    Parser.time(),
                    {_account: req.account.id, _event: req.params.event || 'ping', _id: Id.new}
                );
                await this.transformers.LocationFromIP.transform(context,body);
                await this.transformers.Holiday.transform(context,body);
                await this.transformers.Weather.transform(context,body);
                await this.collection.insertOne(body);
                res.json(body);
            } catch (e) {
                console.error(`Error pinging event`, e);
                res.status(500).json({status: 'error', message: `Error invoking ${req.method} on data: ${e.message}`});
            }
        });
        return router;
    }
    async castFields(o) {
        let fields = await this.fieldCollection.find({_id:{$in:Object.keys(o)}}).toArray();
        fields = fields.reduce((r,f)=>{r[f._id]=f;return r},[]);
        return Object.keys(o).reduce((r,k)=>{
            if (fields[k] && fields[k].dataType) {
                if (['int','long','double','decimal'].includes(fields[k].dataType)) r[k] = Number(o[k]);
                else r[k] = o[k];
            } else {
                // else guess
                r[k] = (/^[.0-9]*$/.test(o[k]))?Number(o[k]):o[k];
            }
            return r;
        },{})
    }
}

module.exports = Ping;
