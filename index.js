class EventServer {
    constructor(connector) {
        this.connector = connector;
    }
    routes() {
        let router = require('express').Router();
        // set routes for open services
        for (let name of ['Ontology']) {
            let comp = new (require('./components/'+name))(this.connector)
            router.use('/'+name.toLowerCase(),comp.routes());
        }
        // set routes for account services
        router.use('/a/:id',(req,res,next)=>{
            req._account = req.params.id;
            next();
        });
        for (let name of ['Ping','Link','Search']) {
            let comp = new (require('./components/'+name))(this.connector)
            router.use('/a/*/'+name.toLowerCase(),comp.routes());
        }
        return router;
    }
}
module.exports = EventServer
