let Formatter = require('./formatter');

class Chart extends Formatter {
    constructor(props) {
        super(props);
        this.type = props[0];
    }
    construct(data) {
        let flat = this.flatten(data);
        let labels=flat.rows.map(row=>row[flat.template[0]]);
        let datasets=flat.rows.map(row=>row[flat.template[0]]);
        for (let set of flat.template.slice[1]) {
            datasets.push({label:set,data:flat.rows.map(row=>row[set])});
        }
        return {labels:labels,datasets:datasets};
    }
    async render(res,data) {
        let head = `<meta charset="utf-8"><script src="/lib/chartjs"></script>`;
        let body = `<body><canvas id="canvas" width="400" height="400"></canvas></body>`;
        let control = {
            type:this.type||'bar',
            data:this.construct(data),
            options:{scales:{y:{beginAtZero:true}}}
        }
        let script = `
            <script>
            let ctx=document.getElementById('canvas').getContext('2d');
            const chart=new Chart(ctx, ${JSON.stringify(control)});
            </script>
        `;
        let html = `<!DOCTYPE html><html><head>${head}</head><body>${body}<script>${script}</script></body></html>`;
        res.send(html);
    }
}
module.exports = Chart;
