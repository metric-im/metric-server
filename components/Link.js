let express = require('express');
let fs = require('fs');

class Wiki {
    constructor(connector) {
        this.connector = connector;
    }
    routes() {
        let router = require('express').Router();
        router.get("/:linkid",async(req,res)=>{
            try {
                let result = await this[req.method](req.params.linkid,req.query);
                res.set("Content-Type","text/plain");
                res.send(result);
            } catch(e) {
                console.error(`Error invoking ${req.method} on data`,e);
                res.status(500).send(`Error invoking ${req.method} on data: ${e.message}`);
            }
        });
        return router;
    }
}

module.exports = Wiki;