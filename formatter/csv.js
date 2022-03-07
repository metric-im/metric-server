let Formatter = require('./formatter');

class CSV extends Formatter {
    constructor(dp,props) {
        super(dp,props);
    }
    async render(res,data) {
        let flat = this.flatten(data);
        let csv = "";
        if (this.options.inverse) {
            for (let col of flat.template) {
                let row = `"${col}",`;
                for (let r of flat.rows) row+=(typeof(r[col])==='string'?"\""+r[col]+"\"":r[col])+",";
                csv += row.slice(0,-1)+'\n';
            }
        } else {
            let header = "";
            for (let col of flat.template) header+="\""+col+"\",";
            csv = header.slice(0,-1)+'\n';
            for (let col of flat.rows) {
                let row = "";
                for (let f of Object.keys(col)) row+=(typeof(col[f])==='string'?"\""+col[f]+"\"":col[f])+",";
                csv += row.slice(0,-1)+'\n';
            }
        }
        if (this.options.file) {
            this.sendFile(res,csv,'data.csv');
        } else {
            res.setHeader('Content-type', 'text/plain');
            res.charset = 'UTF-8';
            res.write(csv);
            res.end();
        }
    }
}
module.exports = CSV;
