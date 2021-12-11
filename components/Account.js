const crypto = require('crypto');

class Account {
    constructor(connector) {
        this.collection = connector.db.collection('accounts')
    }
    static async mint(connector) {
        return new Account(connector);
    }

    async attach(req,res,next) {
        let auth = req.query.auth;
        if (!auth) return next();
        let match = auth.match(/^([a-zA-Z0-9]+):([a-zA-Z0-9]+)$/);
        if (!match) return next();
        let id = match[1];
        let proof = match[2];
        let account = await this.collection('accounts').findOne({"keys.id":id});
        if (!account) return next();
        let key = account.keys[account.keys.findIndex(k=>k.id===id)];
        let hmac = crypto.createHmac('sha256',key.secret);
        let proofTest = hmac.update(key.id).digest('hex');
        if (proofTest.toLowerCase() === proof.toLowerCase()) req._account = account;
        next();
    };
}
module.exports = Account;