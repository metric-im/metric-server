let Parser = require('./Parser');
let Id = require('@metric-im/identifier');
const DimPath = require("./DimPath");
const pixel = new Buffer.from('R0lGODlhAQABAJAAAP8AAAAAACH5BAUQAAAALAAAAAABAAEAAAICBAEAOw==','base64');

/**
 * Record an event. This route is public with a few caveats:
 * * Only validated sessions can record `_account`
 * * The first path parameter is the event namespace, _ns. If not provide "ping" is the default
 * * `_time` is always written by the system in UTC
 * * date (YYYY/MM/DD string), year, month, day, hour, minute and week are reserved and calculated
 *
 * A namespace can define its attributes and how to handle them. If not provided,
 * all data sent via query string is recorded as strings. Use PUT method to provide
 * native attribute types in the body via JSON.
 *
 * Server calls can populate _origin to establish context. _origin is
 * parsed for ua (user agent), ip address, hostname and url. If not
 * provided the express request values are used.
 *
 * Refiners are applied to the event according to the definition of
 * the event namespace. A refiner can add or modify event attributes.
 * Each refiner defines the attributes it requires and those it provides.
 * This is used to sort the execution
 */
class Ping {
    constructor(connector) {
        this.connector = connector;
        this.collection = this.connector.db.collection('event');
        this.ontology = new (require('./Ontology'))(connector);
        this.refinery = {};
        for (let name of ['BrowserIdentity','LocationFromIp','Holiday','Weather','FuelPrice']) {
            this.refinery[name] = new (require('../refinery/'+name))(connector);
        }
    }

    routes() {
        let router = require('express').Router();
        router.use((req,res,next)=>{
            if (req.account && req.account.id) next();
            else res.status(401).send();
        })
        router.all("/:ns?", async (req, res) => {
            try {
                let ns = await this.ontology.nameSpace.get(req.account,req.params.ns)
                let fieldMap = await this.ontology.nameSpace.fields(req.account,req.params.ns);
                let context = Object.assign({
                    hostname:req.hostname,
                    url:req.url,
                    ip:req.ip,
                    ua:req.headers['user-agent']
                },req.body._origin);
                if (context.ip === '::ffff:127.0.0.1') context.ip = req.headers['x-forwarded-for'];
                if (req.body._origin) delete req.body._origin;
                if (this.connector.profile.profile==="DEV" && context.ip === '::1') context.ip = '208.157.149.67';
                let parsedQuery = await this.castFields(req.query,fieldMap);
                let parsedBody = await this.castFields(req.body,fieldMap)
                let body = Object.assign({},
                    parsedBody,
                    parsedQuery,
                    Parser.time(),
                    {_account: req.account.id, _ns: req.params.ns || 'ping', _id: Id.new}
                );
                for (let refiner of ns.refinery) {
                    await this.refinery[refiner].process(context,body);
                }
                await this.collection.insertOne(body);
                res.json(body);
            } catch (e) {
                console.error(`Error pinging event`, e);
                res.status(500).json({status: 'error', message: `Error invoking ${req.method} on data: ${e.message}`});
            }
        });
        return router;
    }
    async castFields(o,fields) {
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