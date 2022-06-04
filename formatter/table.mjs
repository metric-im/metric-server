import Formatter from './formatter.mjs';

export default class Table extends Formatter {
    constructor(dp,props) {
        super(dp,props);
    }
    construct(data) {
        let flat = this.flatten(data);
        let header = "";
        for (let col of flat.template) header+="<th><div>"+col+"</div></th>";
        header = "<tr>"+header+"</tr>\n";
        let rows = "";
        for (let col of flat.rows) {
            let row = "";
            for (let f of Object.keys(col)) row+="<td>"+col[f]+"</td>";
            rows += "<tr>"+row+"</tr>\n";
        }
        return `<table>\n<thead>${header}</thead>\n<tbody>\n${rows}</tbody>\n</table>\n`;
    }
    async render(res,data) {
        let table = this.construct(data);
        let style
        let html = `
<!DOCTYPE html><html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
${this.style}
</head>
<body><div class="table-container">${table}</div></body>
</html>`;

        res.send(html);
    }
    get style() {
        return `
<style>
:root {
    --page-border:lightgray;
    --cell-bg:white;
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
BODY {
    margin:0;
    padding:0;
    border:0;
    height:100vh;
}
.table-container {
    position:relative;
    width:100%;
    height:100%;
    border:1px solid var(--page-border);
    overflow:auto;
    box-sizing:border-box;
}
TABLE {
    width:100%;
    border-collapse: collapse;
}
thead {
    position:sticky;
    inset-block-start: 0;
    background-color:var(--cell-bg);
}
th, td {
    text-align:left;
    vertical-align:top;
}
td {
    padding: var(--spacerhalf) var(--spacer);
}
th div {
    padding: var(--spacerhalf) var(--spacer);
    border-bottom:1px solid var(--page-border);
}
</style>
`;
    }
}
