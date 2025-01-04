import Formatter from './formatter.mjs';

export default class Chart extends Formatter {
    constructor(dp,props) {
        super(dp,props);
        this.props = {};
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
        let dimensions = this.dp.dimensions.map(d=>({name:d.name,compressed:d.compressor===this.dp._COMPRESS}));
        while(dimensions.length>0 && dimensions[dimensions.length-1].compressed) dimensions.pop();
        let labels = data.map(row=>dimensions.map(d=>row[d.name]).join('.'));
        let keys = data.reduce((keys,row)=>{
            for (let key of Object.keys(row).filter(key=>!dimensions.find(d=>d.name===key))) {
                let name = key.split('.').pop();
                keys[key] = this.dp.metrics.find(m=>m.name===name);
            }
            return keys;
        },{});
        let datasets = Object.entries(keys).map(([key,metric])=>{
            let dataset = {
                label:key+(metric.method!=='sum'&&!this.options.quiet?` (${metric.method})`:""),
                data:data.map(row=>row[key]),
                backgroundColor:invert?colorSet.subtle:color.subtle(),
                borderColor:invert?colorSet.solid:color.solid(),
                borderWidth:1
            }
            dataset.label = dataset.label.replace(/_count$/,"");
            if (this.type==='line') {
                dataset.cubicInterpolationMode = 'monotone'
                if (data.length > 25 || this.options.quiet)  dataset.pointRadius = 0;
                if (this.options.fill) dataset.fill = true;
            }
            color.next();
            return dataset;
        },[]);
        return {labels:labels,datasets:datasets};
    }
    async render(res,data) {
        let invert = ['pie','doughnut','polarArea'].includes(this.type);
        let trayStyle = "position:relative;display:flex;height:100%"
        let containerStyle = "flex:1 0;width:100%;height:100%;align-self:center";
        let head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">`
        + `<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>`
        + `<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom"></script>`
        + `<script src="https://cdn.jsdelivr.net/npm/hammerjs"></script>`
        // + `<script src="${process.env.METRIC_ROOT||""}/lib/chartjs"></script>`
        // + `<script src="${process.env.METRIC_ROOT||""}/lib/hammer.min.js"></script>`
        // + `<script src="${process.env.METRIC_ROOT||""}/lib/chartjs-zoom"></script>`
        let body =
                `<div style="${trayStyle}">
                    <div id="container" style="${containerStyle}"><canvas id="canvas"></canvas></div>
                </div>`;
        let control = {
            type:this.type||'bar',
            data:this.construct(data,invert),
            options:{
                maintainAspectRatio:false,
                responsive:true,
                plugins: {zoom: {
                    zoom: {wheel: {enabled: true},pinch: {enabled: true},mode: 'x'}}},
                    pan: {enabled:true,mode:'x'}
            }
        }
        if (this.options.quiet) {
            control.data.labels = control.data.labels.map(l=>"");
        }
        if (this.options.nolegend) {
            control.options.plugins.legend = {display:false};
        }
        if (this.options.stacked) {
            if (!control.options.scales) control.options.scales = {};
            if (!control.options.scales.x) control.options.scales.x = {};
            if (!control.options.scales.y) control.options.scales.y = {};
            control.options.scales.y.stacked = true;
            if (this.type === 'bar') control.options.scales.x.stacked = true;
        }
        if (this.options.horizontal) {
            control.options.indexAxis = 'y';
        }

        let script = `
            <script lang="JavaScript">
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
            {r:28, g:168, b:221, a:1},
            {r:27, g:201, b:142, a:1},
            {r:159, g:134, b:255, a:1},
            {r:228, g:216, b:54, a:1},
            {r:250, g:136, b:140, a:1},
            {r:65, g:186, b:191, a:1},
            {r:21, g:78, b:168, a:1},
            {r:160, g:165, b:3, a:1},
            {r:127, g:232, b:150, a:1},
            {r:232, g:195, b:127, a:1},
            {r:232, g:127, b:225, a:1},
            {r:127, g:232, b:207, a:1},
            {r:192, g:232, b:127, a:1},
            {r:65, g:112, b:106, a:1},
        ];
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
