/**
 * Stash an api request.
 */
import moment from 'moment';
import express from 'express';
import crypto from "crypto";
import axios from "axios";
let stash = {};
export default class Stash {
    constructor(connector) {
        this.connector = connector;
    }
    static timer = null;
    static cleanUp = 0;
    routes() {
        //TODO: not fully implemented with authentication response type
        let router = express.Router();
        router.use((req,res,next)=>{
            if (req.account && req.account.id) next();
            else res.status(401).send();
        })
        router.all("/:seconds/*", async (req, res) => {
            try {
                let result = await Stash.get(req.account,req.url.replace(/\/\d+?\//,""),parseInt(req.params.seconds));
                res.send(result);
            } catch (e) {
                console.error(`Error with request`, e);
                res.status(500).json({status: 'error', message: `Error requesting data: ${e.message}`});
            }
        });
        return router;
    }
    static async get(account,url,secs=60) {
        // perform garbage collection every five minutes
        if ((Date.now() - Stash.cleanUp) > 0) {
            for (let record in stash) {
                if ((Date.now() - record.expires) < 0) delete stash[record];
            }
            Stash.cleanUp = Date.now() + 300000;
        }
        // Hash url and look up active results
        let hashid = "ID"+crypto.createHash('md5').update(account.id+url).digest('hex');
        let result;
        let stashed = stash[hashid];
        if (stashed && ((Date.now() - stashed.expires) < 0)) {
            result = stashed.result;
        } else {
            result = await axios.get(url);
            stash[hashid] = {result:result,expires:Date.now()+(secs*1000)};
        }
        return result;
    }
}
