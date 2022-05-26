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
                if (!fieldMap) fieldMap = {};
                let context = Object.assign({
                    hostname:req.hostname,
                    url:req.url,
                    ip:req.ip,
                    ua:req.headers['user-agent']
                },req.body._origin);
                if (this.connector.profile.PROFILE==="DEV" && context.ip === '::1') context.ip = '208.157.149.67';
                if (context.ip === '::ffff:127.0.0.1') context.ip = req.headers['x-forwarded-for'];
                if (Array.isArray(req.body)) {
                    let writes = [];
                    for (let o of req.body) {
                        o = this.castFields(o,fieldMap);
                        let doc = Object.assign(o,Parser.time(o._time),o._origin,{_account: req.account.id, _ns: req.params.ns, _id: this.connector.idForge.datedId()});
                        if (o._origin) delete o._origin;
                        for (let refiner of ns.refinery||[]) await NameSpace.refinery[refiner].process(context,doc);
                        writes.push({insertOne:{document:doc}});
                    }
                    let result = await this.collection.bulkWrite(writes);
                    res.json(result);
                } else {
                    let o = Object.assign(this.castFields(req.body,fieldMap),this.castFields(req.query,fieldMap));
                    let body = Object.assign(o,Parser.time(o._time),req.body._origin,{_account: req.account.id, _ns: req.params.ns, _id: this.connector.idForge.datedId()});
                    if (req.body._origin) delete req.body._origin;
                    for (let refiner of ns.refinery||[]) await NameSpace.refinery[refiner].process(context,body);
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
}
