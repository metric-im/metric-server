import Formatter from './formatter.mjs';

export default class Chart extends Formatter {
    constructor(dp,props) {
        super(dp,props);
        this.type = props[0];
    }
    construct(data,invert) {
        let color = new ColorFactory();
        let colorSet = invert?data.reduce((r,d)=>{
            r.subtle.push(color.subtle());
            r.solid.push(color.solid());
            color.next();
            return r;
        },{subtle:[],solid:[]}):null;
        let labels = data.map(row=>{
            return this.dp.dimensions.map(d=>row[d.name]).join('.');
        });
        let datasets=this.dp.metrics.map(metric=>{
            let dataset =  {
                label:metric.name+(metric.method!=='sum'?` (${metric.method})`:""),
                    data:data.map(row=>row[metric.name]),
                backgroundColor:invert?colorSet.subtle:color.subtle(),
                borderColor:invert?colorSet.solid:color.solid(),
                borderWidth:1,
            }
            color.next();
            return dataset;
        });
        return {labels:labels,datasets:datasets};
    }
    async render(res,data) {
        let invert = ['pie','doughnut','polarArea'].includes(this.type);
        let trayStyle = "position:relative;display:flex"
        let containerStyle = "flex:1 0;width:100%;height:100%;align-self:center";
        let head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">`
            + `<script src="https://metric.im/lib/chartjs"></script>`
        let body =
                `<div style="${trayStyle}">
                    <div id="container" style="${containerStyle}"><canvas id="canvas"></canvas></div>
                </div>`;
        let control = {
            type:this.type||'bar',
            data:this.construct(data,invert),
            options:{scales:{y:{beginAtZero:true}},maintainAspectRatio:false,responsive:true}
        }
        let script = `
            <script lang="JavaScript">
            console.log(window.innerWidth+","+window.innerHeight);
            let canvas = document.getElementById('canvas');
            let ctx=canvas.getContext('2d');
            let data = ${JSON.stringify(control)};
            const chart=new Chart(ctx, data);
            chart.resize(window.innerWidth,window.innerHeight);
            document.addEventListener('resize',()=>{
                chart.resize(window.innerWidth,window.innerHeight);
            })
            </script>
        `;
        let html = `<!DOCTYPE html>\n<html>\n<head>${head}</head>\n<body style="margin:0;padding:0">\n${body}\n${script}\n</body>\n</html>`;
        res.send(html);
    }
}
class ColorFactory {
    constructor() {
        this.base = [
            {r:255, g:99, b:132, a:1},
            {r:54, g:162, b:235, a:1},
            {r:255, g:206, b:86, a:1},
            {r:75, g:192, b:192, a:1},
            {r:153, g:153, b:255, a:1},
            {r:255, g:159, b:64, a:1}
        ]
        this.current = 0;
    }
    reset() {
        this.current = 0;
    }
    next() {
        if (++this.current >= this.base.length) this.current = 0;
    }
    solid() {
        return this.rgb(this.base[this.current]);
    }
    subtle() {
        return this.rgb(this.base[this.current],{a:0.2});
    }
    rgb(color,modifier) {
        color = Object.assign({},color,modifier);
        return `rgba(${color.r},${color.g},${color.b},${color.a})`
    }
}
