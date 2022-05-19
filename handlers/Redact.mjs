/**
 * Redact an event. Admins can remove events posted with ping
 */
import moment from 'moment';
import express from 'express';
import Ontology from './Ontology.mjs';
export default class Redact {
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
        router.all("/:ns/:id?", async (req, res) => {
            try {
                let ns = await this.ontology.nameSpace.get(req.account,req.params.ns,3);
                if (!ns) return res.status(401).send();
                if (req.params.id) {
                    let ids = req.params.id.split(',');
                    let result = await this.collection.deleteMany({_ns:ns._id,_id:{$in:ids}});
                    res.send(result);
                } else {
                    let since = moment()
                    if (req.query.minutes) since = since.subtract(parseFloat(req.query.minutes),"m");
                    if (req.query.hours) since = since.subtract(parseFloat(req.query.hours),"h");
                    if (req.query.days) since = since.subtract(parseFloat(req.query.days),"d");
                    let result = await this.collection.deleteMany({_ns:ns._id,_time:{$gte:since.toDate()}});
                    res.send(result);
                }
            } catch (e) {
                console.error(`Error removing event`, e);
                res.status(500).json({status: 'error', message: `Error removing event data: ${e.message}`});
            }
        });
        return router;
    }
}
