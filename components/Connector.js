/**
 * Connect to the database and account, if authorization is provided
 */

let Credentials = require('./Credentials');

class Connector {
    constructor(profile="") {
        this.profile = profile;
        this.credentials = Credentials[this.profile||process.env.PROFILE];
        if (!this.credentials) throw new Error("profile is not defined");
    }

    /**
     * Mint is an async implementation for new Connector
     * @param profile PROD, DEV or STAGING
     * @returns Connector
     */
    static async mint(profile) {
        let connector = new Connector(profile);
        if (!connector.credentials) throw new Error(`Unknown profile: ${profile}`);
        connector.MongoClient = require('mongodb').MongoClient;
        let mongo = await connector.MongoClient.connect(
            connector.credentials.mongo.host,
            {useNewUrlParser:true,useUnifiedTopology:true}
        );
        connector.db = mongo.db();
        return connector;
    }

    /**
     * Attach the connector to the request object for downstream use
     */
    attach(req,res,next) {
        req.connector = this;
        next();
    }
}

module.exports = Connector;