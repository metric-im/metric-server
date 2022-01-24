const Data = require("./Data");

class Access {
    constructor(connector) {
        this.connector = connector;
        this.collection = this.connector.db.collection('access');
        this.data = new Data(connector);
    }
    get test() {
        return {
            read:async (account,target,id)=>{
                await this.collection.find()
            },
            write:async (account,target,id)=>{

            },
            delete:async (account,target,id)=>{

            },
        }
    }
}