import axios from 'axios';
export default class FuelPrice {
    constructor(connector) {
        this.connector = connector;
        this.requires = ['location'];
        this.provides = [];
        this.key = this.connector.profile.DATAGOV_KEY;
        this.base = "https://api.eia.gov/category"
    }
    async process(context,event) {
    }
}
