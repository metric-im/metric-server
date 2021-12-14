/**
 * Run command line processors
 */
const Connector = require('@metric-im/connector');
const moment = require('moment');
const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');
const prompt = require('prompt-sync')({sigint: true});
const fs = require('fs');

let timeFormat = "YYYY-MM-DD:HH:mm:ss";

let commandOptions = [
    {name:'profile',alias:'p',type:String,typeLabel:"{underline profile}",description:"DEV, PROD or STAGING. Default is PROD"},
    {name:'days',alias:'d',type:Number,typeLabel:"{underline days}",description:"Limit the number of days back to process."},
    {name:'minutes',alias:'m',type:Number,typeLabel:"{underline minutes}",description:"Limit the number of minutes back to process. If --days is specified, minutes includes days translated to minutes."},
    {name:'account',alias:'a',type:String,multiple:true,typeLabel:"{underline account(s)}",description:"The account(s) to process. If not provided, all active accounts are selected."},
    {name:'user',alias:'u',type:String,typeLabel:"{underline user}",description:"The user to process."},
    {name:'new',type:String,typeLabel:"{underline new}",description:"The user to process."},
    {name:'delete',type:String,typeLabel:"{underline delete}",description:"The user to process."},
    {name:'update',type:String,typeLabel:"{underline update}",description:"The user to process."},
    {name:'rekey',type:String,typeLabel:"{underline rekey}",description:"update the JWT secret in env"}
];
let commandStructure = [
    {
        header:"Publisher Marketplace CLI",
        content:"Currently supports basic user management features"
    },
    {
        header: 'Synopsis',
        content: '$ node cli <command> <options>'
    },
    {
        header: "Options",
        optionList: commandOptions.filter(o=>['profile','user','help','new','delete','update'].includes(o.name))
    },
    {
        header:"Command List",
        content:[
            {name:"User",summary:"Add, update and delete a user record"},
            {name:"Test",summary:"Used for development purposes to test different aspects of the system"}
        ]
    }
];

async function main() {
    let service = commandLineArgs({ name: 'name', defaultOption: true }, { stopAtFirstUnknown: true });
    let argv = service._unknown || [];
    let options = commandLineArgs(commandOptions,{argv});
    let connector;
    try {
        connector = await Connector.mint(options.profile||process.env.PROFILE);
    } catch(e) {
        console.error("ERROR: the envar PROFILE has not been set or does not exist");
        process.exit(0);
    }
    if (service.name==="help" || service.name==="?") {
        console.log(commandLineUsage(commandStructure));
    } else if (service.name==="user") {
        let User = require("@metric-im/session").User;
        let user = new User(connector);
        let name = prompt('username:');
        let pass = prompt.hide('password:');
        let pass2 = prompt.hide('renter:');
        if (pass !== pass2) console.error("passwords don't match");
        else {
            await user.new(name,pass);
        }
    } else if (service.name==="rekey") {
        let parsed = require('dotenv').config().parsed;
        parsed.SECRET = require('crypto').randomBytes(64).toString('hex');
        let text = Object.keys(parsed).reduce((r,k)=>r+`${k}=${parsed[k]}\n`,"")
        fs.writeFileSync('.env',text);
        console.log(".env updated with new secret");
    }
}

(async () => {
    await main();
    process.exit(1);
})().catch(e => {
    console.error('Error in main()', e);
    console.log(e.message);
    console.log(e.stack);
    process.exit(0);
});
