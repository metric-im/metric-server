'use strict';

let express = require('express');
let http = require('http');
let path = require('path');
let bodyParser = require('body-parser');
let app = express();
let logger = require('morgan');
let cors =  require('cors');

// open cors
app.use(cors({origin: function(origin, callback){return callback(null, true);},credentials:true}));

// connect web server
let server = http.createServer(app);
server.listen(process.env.PORT || "5001");
server.on('error', function(err) {console.error(err);});

// on server available, open routes
server.on('listening', async ()=>{
    let address = server.address();
    console.log(`Listening on port ${address.port} profile ${process.env.PROFILE}`);
    try {
        // connect public middleware
        app.use(logger('dev'));
        app.use(bodyParser.json({limit: '50mb'}));
        app.use(bodyParser.urlencoded({extended: false}));
        app.use(require('cookie-parser')());
        app.use(express.static(path.join(__dirname, 'public')));
        app.get('/health', (req, res) => { res.status(200).send() });

        // connect to database services
        let connector = await (require('@metric-im/connector')).mint(process.env.PROFILE);
        app.use(connector.attach.bind(connector));

        // set routes for open services
        for (let name of ['Schema','Wiki','UML']) {
            let comp = new (require('./components/'+name))(connector)
            app.use('/'+name.toLowerCase(),comp.routes());
        }
        // set routes for account services
        app.use('/a/:id',(req,res,next)=>{
            req._account = req.params.id;
            for (let name of ['Ping','Link','Search']) {
                let comp = new (require('./components/'+name))(connector)
                app.use('/a/*/'+name.toLowerCase(),comp.routes());
            }
            next();
        });
    } catch(e) {
        console.error(e);
        process.exit();
    }
});

process.on('SIGINT', function() {
    console.log("Shutting down");
    process.exit();
});
