'use strict';

let express = require('express');
let http = require('http');
let path = require('path');
let bodyParser = require('body-parser');
let app = express();
let Session = require('./components/Session');
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
    console.log(`Listening on port ${dress.port} profile ${process.env.PROFILE}`);
    try {
        // connect public middleware
        app.use(logger('dev'));
        app.use(bodyParser.json({limit: '50mb'}));
        app.use(bodyParser.urlencoded({extended: false}));
        app.use(require('cookie-parser')());
        app.use(express.static(path.join(__dirname, 'public')));
        app.get('/health', (req, res) => { res.status(200).send() });

        // connect to database services
        let connector = await (require('./components/Connector')).mint(process.env.PROFILE);
        app.use(connector.attach.bind(connector));
        // attach account if authorization is provided
        let account = await (require('./components/Account')).mint(connector);
        app.use(account.attach.bind(account));

        // set routes for component services
        for (let name of ['Ping','Link','Search','Schema','Wiki','UML']) {
            let comp = new (require('./components/'+name))(connector)
            app.use('/'+name.toLowerCase(),comp.routes());
        }
    } catch(e) {
        console.error(e);
        process.exit();
    }
});

process.on('SIGINT', function() {
    console.log("Shutting down");
    process.exit();
});
