let Parser = require('./Parser');
let Id = require('@metric-im/identifier');

/**
 * Record an event. This route is public with a few caveats:
 * * Only validated sessions can record `_account`, otherwise default is "public"
 * * The first path parameter is recorded as _event. If not provide "ping" is the default
 * * `_time` is always written by the system in UTC
 * * date (YYYY/MM/DD string), year, month, day, hour, minute and week are reserved and calculated
 *
 * All data sent via query string is recorded as strings. Use PUT method to provide specific
 * attribute types in the body via JSON.
 */
class Ping {
    constructor(connector) {
        this.connector = connector;
        this.collection = this.connector.db.collection('events');
    }

    routes() {
        let router = require('express').Router();
        router.use((req,res,next)=>{
            if (req.account && req.account.id) next();
            else res.status(401).send();
        })
        router.all("/:event?", async (req, res) => {
            try {
                let body = Object.assign({},
                    req.body || {},
                    req.query || {},
                    Parser.time(),
                    {_account: req.account.id, _event: req.params.event || 'ping', _id: Id.new}
                );
                await this.collection.insertOne(body);
                res.json(body);
            } catch (e) {
                console.error(`Error pinging event`, e);
                res.status(500).json({status: 'error', message: `Error invoking ${req.method} on data: ${e.message}`});
            }
        });
        return router;
    }
}

module.exports = Ping;
