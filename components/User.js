let Data = require('./Data');
const bcrypt = require("bcrypt");

class User {
    constructor(connector) {
        this.connector = connector
    }
    routes() {
        let router = require('express').Router();
        router.get("/", async (req,res)=>{
            try {
                res.json({_id:'test'})
            } catch (e) {
                console.error(`Error getting user`, e);
                res.status(500).json({status: 'error', message: `${e.message}`});
            }
        });
        // router.put("/", async (req,res)=>{
        //     try {
        //         let body = Object.assign()
        //         res.json({_id:'test'})
        //     } catch (e) {
        //         console.error(`Error getting user`, e);
        //         res.status(500).json({status: 'error', message: `${e.message}`});
        //     }
        // });
        return router;
    }
    async new(username,pass) {
        console.log(`registering ${username}`);
        let data = new Data(this.connector);
        let user = await this.connector.db.collection('users').findOne({username:username});
        if (user) return console.log('user exists');
        await data.put('users',{username:username,hash:User.hashPass(pass)});
        console.log(`done`);
    }
    static hashPass(pass) {
        return bcrypt.hashSync(pass,10)
    }
    static testPass(pass,hash) {
        return bcrypt.compareSync(pass,hash);
    }
}
module.exports = User;