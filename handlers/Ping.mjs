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
    constructor(connector,collection='event') {
        this.connector = connector;
        this.collection = this.connector.db.collection(collection);
        this.ontology = new Ontology(connector);
    }

    routes() {
        let router = express.Router();
        router.all("/:format/:ns?", async (req, res) => {
            try {
                let {format,ns} = req.params;
                if (!ns) {ns = format;format = 'silent';}
                ns = await this.ontology.nameSpace.get(req.account,ns,2);
                if (!ns) return res.status(401).send();
                let body = Object.assign({},req.body,req.query,{_ns:ns._id});
                if (!body._origin) body._origin = {
                    ip: req.headers['x-forwarded-for']?req.headers['x-forwarded-for'].split(',')[0]:req.ip,
                    ua: req.get('User-Agent')
                };
                let result = await this.execute(body,ns);
                switch(req.params.format) {
                    case "json":
                        res.json(result);
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
                        let data = Object.keys(result).sort().map(key=>`<tr><td>${key}: </td><td><b>${result[key]}</b></td></tr>`);
                        res.send(`<html><body><table>${data.join("")}</table></body></html>`);
                        break;
                    case "silent":
                    default:
                        res.status(204).send();
                        break;
                }
            } catch (e) {
                console.error(`Error pinging event`, e);
                res.status(500).json({status: 'error', message: `Error invoking ${req.method} on data: ${e.message}`});
            }
        });
        return router;
    }
    // Lookup explicit declarations for the attribute in the given namespace or guess
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

    /**
     * The ping request may include an attribute named _origin. This is
     * a structure that presents the contextual data about the session
     * as known to the calling app. _origin can set the IP, the User Agent
     * and other attributes.
     * @param body event attributes
     * @param ns namespace of event
     * @returns {Promise<{}>}
     */
    async embellishBody(body,ns) {
        let context = {connector:this.connector};
        if (body._origin) {
            // query string _origin needs to be parsed. This is mostly a DEBUG feature
            if (typeof body._origin === 'string') body._origin = JSON.parse(body._origin);
            // only take explicit attributes from the _origin object then delete it.
            if (body._origin.ip) context.ip = body._origin.ip;
            if (body._origin.ua) context.ua = body._origin.ua;
            if (body._origin.tz) context.tz = body._origin.tz;
            if (body._origin.tzoff) context.tzoff = body._origin.tzoff;
            if (body._origin.lang) {
                context.lang = body._origin.lang;
                if (!body.language) body.language = body._origin.lang;
            }
            delete body._origin;
        }
        let fieldmap = await this.ontology.nameSpace.fields(body._account,ns||body._ns)
        body = this.castFields(body,fieldmap);
        body._time = body._time?new Date(body._time):new Date();
        body._id = this.connector.idForge.datedId();
        for (let refiner of ns?.refinery||[]) await NameSpace.refinery[refiner].process(context,body);
        return body;
    }
    async execute(body={},ns) {
        try {
            if (!ns) ns = await this.ontology.nameSpace.get(body._account,body._ns)
            if (Array.isArray(body)) {
                let writes = [];
                for (let o of body) {
                    let body = await this.embellishBody(o,ns);
                    writes.push({insertOne:{document:body}});
                }
                let result = await this.collection.bulkWrite(writes);
                return result;
            } else {
                body = await this.embellishBody(body,ns);
                let result = await this.collection.insertOne(body);
                return result;
            }
        } catch(e) {
            throw(e);
        }
    }
}
