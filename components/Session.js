let bcrypt = require('bcrypt')
let User = require('./User');
let moment = require('moment');
let jwt = require('jsonwebtoken')

class Session {
    constructor(connector) {
        this.connector = connector;
    }
    routes() {
        let router = require('express').Router();
        router.get("/login", async (req,res)=>{
            try {
                let auth = this.auth(req);
                let user = await this.connector.db.collection('users').findOne({username:auth.username});
                if (user && User.testPass(auth.pass,user.hash)) {
                    let token = jwt.sign({userId:user._id},process.env.SECRET,{expiresIn:'10d'});
                    this.setCookie(req,res,token);
                    res.json({status:'success'})
                } else {
                    res.status(401).json({status:'error',message:'not authorized'})
                }
            } catch (e) {
                console.error(`Error getting article`, e);
                res.status(500).json({status: 'error', message: `${e.message}`});
            }
        });
        router.get("/test",(req,res)=>{
            try {
                let check = jwt.verify(req.cookies.pubm,process.env.SECRET);
                res.status(201).send();
            } catch(e) {
                res.status(401).send();
            }
        })
        return router;
    }
    async test(req,res,next) {
        try {
            if (req.userId) next();
            let check = jwt.verify(req.cookies.pubm,process.env.SECRET)
            req.userId = check.userId;
            next();
        } catch(e) {
            if (!res) next(); // no response object so no response expected
            else Session.onfail.call(this,req,res,next);
        }
    }

    /**
     * Adds a long living cookie which carries the JWT token. The token
     * will govern time to live.
     * @param res
     */
    setCookie(req,res,token) {
        let expires = moment().add( 45 ,'day').toDate();
        res.cookie("pubm",token,{expires:expires,sameSite:"Lax",domain:Session.identifyDomain(req.hostname)});
    }
    auth(req) {
        let match = (req.headers.authentication||"").match(/^Basic (.*)/);
        if (!match) return null;
        let decode = Buffer.from(match[1],'base64').toString('ascii').split(':');
        return {username:decode[0],pass:decode[1]};
    }
    /**
     * Domain is the root url used to set first cookies. Leading "i"
     * indicating jack request or "staging" indicating devmode are
     * removed;
     * @param hostname
     * @returns {*}
     */
    static identifyDomain(hostname) {
        if (hostname) {
            let rootdomain = hostname.match(/([A-Za-z0-9-_]+\.[A-Za-z]+)(?:\:\d+)?$/);
            if (rootdomain) return rootdomain[1];
        }
        return null;
    };
}
module.exports=Session;

// module.exports = jwt;

// function jwt() {
//     const secret = config.secret;
//     return expressJwt({ secret, algorithms: ['HS256'], isRevoked }).unless({
//         path: [
//             // public routes that don't require authentication
//             '/users/authenticate',
//             '/users/register'
//         ]
//     });
// }
//
// async function isRevoked(req, payload, done) {
//     const user = await userService.getById(payload.sub);
//
//     // revoke token if user no longer exists
//     if (!user) {
//         return done(null, true);
//     }
//
//     done();
// };
