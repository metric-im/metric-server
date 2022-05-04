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
        let table = this.construct(data);
        let style
        let html = `<!DOCTYPE html>\n<html>\n<head><meta charset="utf-8">${this.style}</head>\n<body>\n${table}\n</body>\n</html>`;

        res.send(html);
    }
    get style() {
        return `
<style>
:root {
    --page-border:lightgray;
    --spacer:12px;
    --spacer2:24px;
    --spacer3:36px;
    --spacerhalf:6px;
    --spacerthird:4px;
    --spacerquarter:3px;
    --item-super:#7777DD80;
    --item-elevated:#77DD7780;
    --item-normal:#DDDD7780;
    --item-bad:#DD777780;
    --status-normal:#DDDDDD80;
    --status-success:#77DD7780;
    --status-warning:#DDDD7780;
    --status-error:#DD777780;
}
TABLE {
    background-color:var(--tray-bg);
    border:1px solid var(--page-border);
    width:100%;
    border-collapse: collapse;
}
th, td {
    padding: var(--spacerhalf) var(--spacer);
    text-align:left;
    vertical-align:top;
}
th {
    border:1px solid var(--page-border);
}
</style>
`;
    }
}
module.exports = Table;
