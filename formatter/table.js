let Formatter = require('./formatter');

class Table extends Formatter {
    constructor(dp,props) {
        super(dp,props);
    }
    construct(data) {
        let flat = this.flatten(data);
        let header = "";
        let rows = "";
        for (let col of flat.template) header+="<th>"+col+"</th>";
        rows += "<tr>"+header+"</tr>\n";
        for (let col of flat.rows) {
            let row = "";
            for (let f of Object.keys(col)) row+="<td>"+col[f]+"</td>";
            rows += "<tr>"+row+"</tr>\n";
        }
        return "<table>\n"+rows+"</table>"
    }
    async render(res,data) {
        let html = this.construct(data);
        res.send(html);
    }
}
module.exports = Table;
