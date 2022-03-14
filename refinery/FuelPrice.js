let axios = require('axios');

class FuelPrice {
    constructor(connector) {
        this.connector = connector;
        this.requires = ['location'];
        this.provides = [];
        this.key = this.connector.profile.secrets.DATAGOV_KEY;
        this.base = "https://api.eia.gov/category"
    }
    async process(context,event) {
    }
}
module.exports = FuelPrice;