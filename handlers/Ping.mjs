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
import Parser from './Parser.mjs';
import Ontology from './Ontology.mjs';
import NameSpace from './NameSpace.mjs';
import express from 'express';
const pixel = new Buffer.from('R0lGODlhAQABAJAAAP8AAAAAACH5BAUQAAAALAAAAAABAAEAAAICBAEAOw==','base64');

export default class Ping {
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
        })
        router.all("/:format/:ns", async (req, res) => {
            try {
                let ns = await this.ontology.nameSpace.get(req.account,req.params.ns,2);
                if (!ns) return res.status(401).send();
                let fieldMap = await this.ontology.nameSpace.fields(req.account,req.params.ns);
                let context = Object.assign({
                    hostname:req.hostname,
                    url:req.url,
                    ip:req.ip,
                    ua:req.headers['user-agent'],
                    ns:ns,
                    fieldMap:fieldMap||{}
                });
                if (Array.isArray(req.body)) {
                    let writes = [];
                    for (let o of req.body) {
                        let body = await this.constructBody(context,o,req);
                        writes.push({insertOne:{document:body}});
                    }
                    let result = await this.collection.bulkWrite(writes);
                    res.json(result);
                } else {
                    let body = await this.constructBody(context,Object.assign(req.body,req.query),req);
                    await this.collection.insertOne(body);
                    switch(req.params.format) {
                        case "json":
                            res.json(body);
                            break;
                        case "pixel":
                            res.set("Content-Type","image/gif");
                            res.contentLength = 43;
                            res.end(pixel,'binary');
                            break;
                        case "script":
                            res.set("Content-Type","text/javascript");
                            res.send("{}");
                            break;
                        case 'table':
                            res.set("Content-Type","text/html");
                            let data = Object.keys(body).sort().map(key=>`<tr><td>${key}: </td><td><b>${body[key]}</b></td></tr>`);
                            res.send(`<html><body><table>${data.join("")}</table></body></html>`);
                            break;
                        case "silent":
                        default:
                            res.status(204).send();
                            break;
                    }
                }
            } catch (e) {
                console.error(`Error pinging event`, e);
                res.status(500).json({status: 'error', message: `Error invoking ${req.method} on data: ${e.message}`});
            }
        });
        return router;
    }
    castFields(o,fields) {
        return Object.keys(o).reduce((r,k)=>{
            if (fields[k] && fields[k].dataType) {
                if (['int','integer','long','double','decimal'].includes(fields[k].dataType)) r[k] = Number(o[k]);
                else r[k] = o[k];
            } else {
                // else guess
                r[k] = (/^[.0-9]*$/.test(o[k]))?Number(o[k]):o[k];
            }
            return r;
        },{})
    }
    async constructBody(context,body,req) {
        if (body._origin) {
            // only take explicit attributes from the _origin object then delete it.
            if (body._origin.hostname) context.hostname = body._origin.hostname;
            if (body._origin.url) context.url = body._origin.url;
            if (body._origin.ip) context.ip = body._origin.ip;
            if (body._origin.ua) context.ua = body._origin.ua;
            delete body._origin;
            if (this.connector.profile.PROFILE==="DEV" && context.ip === '::1') context.ip = '208.157.149.67';
            if (context.ip === '::ffff:127.0.0.1') context.ip = req.headers['x-forwarded-for'];
        }
        body = this.castFields(body,context.fieldMap);
        body._time = body._time?new Date(body._time):new Date();
        body._account = req.account.id;
        body._ns = req.params.ns;
        body._id = this.connector.idForge.datedId();
        for (let refiner of context.ns.refinery||[]) await NameSpace.refinery[refiner].process(context,body);
        return body;
    }
}
