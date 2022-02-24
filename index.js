class EventServer {
    constructor(connector) {
        this.connector = connector;
    }
    routes() {
        let router = require('express').Router();
        // set routes services
        for (let name of ['Ping','Pull','Link','Ontology']) {
            let comp = new (require('./components/'+name))(this.connector)
            router.use('/'+name.toLowerCase(),comp.routes());
        }
        return router;
    }
}
module.exports = EventServer
