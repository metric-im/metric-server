let Formatter = require('./formatter');

class JSON extends Formatter {
    constructor(dp,props) {
        super(dp,props);
    }
    async render(res,data) {
        if (this.options.file) this.sendFile(res,data,'data.json');
        else res.json(data);
    }
}
module.exports = JSON;