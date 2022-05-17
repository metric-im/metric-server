class EventServer {
    constructor(connector) {
        this.connector = connector;
    }
    routes() {
        let router = require('express').Router();
        // set routes services
        for (let name of ['Ping','Pull','Link','Ontology','Redact']) {
            let comp = new (require('./handlers/'+name))(this.connector)
            router.use('/'+name.toLowerCase(),comp.routes());
        }
        return router;
    }
}
module.exports = EventServer
