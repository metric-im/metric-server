let axios = require('axios');

class Weather {
    constructor(connector) {
        this.connector = connector;
        this.requires = ['location'];
        this.provides = [];
        this.key = this.connector.profile.secrets.DATAGOV_KEY;
        this.base = "https://api.eia.gov/category"
    }
    async transform(context,event) {
    }
}
module.exports = Weather;