let publisher = require('./publisher');

export default class json extends publisher {
    constructor(props) {
        super(props);
    }
    async render(res,data) {
        res.send(data);
    }
}