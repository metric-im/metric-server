import Component from "./Component.mjs";
import {InputText,InputNumber} from "./InputText.mjs";
import {InputSelect} from "./InputSelect.mjs";
import API from './API.mjs';
import AttributeSelector from "./AttributeSelector.mjs";
import {Button} from "./Button.mjs";

export default class Explore extends Component {
    constructor(props) {
        super(props);
        this.hub = true;
        this.formats=['table','chart.bar','chart.line','chart.pie','json','csv'];
        this.base_data = {
            pingAttributes:[],metrics:[],dimensions:[],pullOptions:[],allAttributes:[],
            namespace:'sample',format:'table',days:null
        };
        let storedData = sessionStorage.getItem('exploredata');
        if (storedData) this.data = JSON.parse(storedData);
        else this.data = this.base_data;
        this.host = "https://metric.im";
    }
    async render(element) {
        await super.render(element);
        // populate data
        this.spaces = await API.get('/ontology/ns');
        this.spaces = this.spaces.map(o=>o._id);
        if (!this.spaces.includes('sample')) this.spaces.unshift('sample');
        await this.loadAttributes();
        // structure page
        this.element.classList.add('page-full');
        this.pageContent = this.div('page-content');
        this.instructions = this.div('explore-instruction',this.pageContent);
        this.div('section-title',this.pageContent).innerHTML="<span class='icon icon-arrow-with-circle-down'></span> PING";
        this.explorePing = this.div('explore-ping property-set',this.pageContent);
        this.pingUrl = this.div('ping-url explore-url',this.pageContent);
        this.div('section-title',this.pageContent).innerHTML="<span class='icon icon-arrow-with-circle-down'></span> PULL";
        this.explorePull = this.div('explore-pull',this.pageContent);
        this.pullConfigure = this.div('pull-configure', this.explorePull);
        this.pullRender = this.div('pull-render', this.explorePull);
        this.pullUrl = this.div('pull-url explore-url',this.pageContent);
        this.pageControls = this.div('page-controls');
        // populate page
        this.writeInstructions();
        await this.writeExplorePing();
        await this.writeExplorePull();
        this.writePingUrl();
        this.writePullUrl();
        await this.writeControls();
        if (this.data.dimensions.length > 0 && this.data.metrics.length > 0) await this.pull();
    }
    async handleUpdate(attributeName) {
        await super.handleUpdate(attributeName);
        this.writePingUrl();
        this.writePullUrl();
        sessionStorage.setItem('exploredata',JSON.stringify(this.data));
    }
    async loadAttributes() {
        this.data.allAttributes = await API.get(`/ontology/ns/${this.data.namespace}/fields`);
    }
    async writeControls() {
        this.btnPing = this.new(Button,{title:"ping",icon:"arrow-bold-up",onClick:this.ping.bind(this)});
        this.btnPing.element.classList.add('primary');
        await this.btnPing.render(this.pageControls);
        this.btnPull = this.new(Button,{title:"pull",icon:"arrow-bold-down",onClick:this.pull.bind(this)});
        this.btnPull.element.classList.add('primary');
        await this.btnPull.render(this.pageControls);
        this.btnClear = this.new(Button,{title:"clear",icon:"ccw",onClick:this.clear.bind(this)});
        await this.btnClear.render(this.pageControls);
    }
    async writeExplorePing() {
        this.pingSpace = this.new(InputSelect,{data:this.data,name:'namespace',options:this.spaces});
        await this.pingSpace.render(this.explorePing);
        this.pingSelector = this.new(AttributeSelector,{
            data:this.data,name:"pingAttributes",title:"attributes",includeValue:true
        });
        this.pingSpace.element.addEventListener('change',async ()=>{
            await this.loadAttributes();
            await this.dimensionSelector.render();
            await this.metricSelector.render();
        });
        await this.pingSelector.render(this.explorePing);
    }
    async writeExplorePull() {
        let topProps = this.div('property-set',this.pullConfigure);
        this.pullFormat = this.new(InputSelect,{data:this.data,name:'format',options:this.formats});
        await this.pullFormat.render(topProps);
        let optionDays = this.new(InputNumber,{data:this.data,name:'days'})
        await optionDays.render(topProps);
        this.dimensionSelector = this.new(AttributeSelector,{
            data:this.data,name:"dimensions",title:"dimensions",includeModifier:true
        });
        await this.dimensionSelector.render(this.pullConfigure);
        this.metricSelector = this.new(AttributeSelector,{
            data:this.data,name:"metrics",title:"metrics",includeModifier:true,extraOptions:['_count'],
            modifierOptions:['sum','avg','max','min','first','last','addToSet']
        });
        await this.metricSelector.render(this.pullConfigure);
        this.resultFrame = document.createElement("iframe");
        this.pullRender.appendChild(this.resultFrame);
    }
    writePingUrl() {
        let attributes = this.data.pingAttributes.map(a=>`${a.name}=${a.value}`).join('&')
        this.pingPath = `/ping/silent/${this.data.namespace}?${attributes}`
        let jsonPath = this.pingPath.replace("/silent/","/json/");
        this.pingUrl.innerHTML = `<a href="${jsonPath}" target="ping">${this.host}${this.pingPath}</a>`;
    }
    writePullUrl() {
        let dimensions = this.data.dimensions.map(a=>`${a.name}${a.value?":"+a.value:""}`).join(',')
        let metrics = this.data.metrics.map(a=>`${a.name}${a.value?":"+a.value:""}`).join(',')
        this.pullPath = `/pull/${this.data.format}/${this.data.namespace}/${dimensions}/${metrics}`;
        let options = [];
        if (this.data.days && this.data.days > 0) options.push("days="+this.data.days);
        if (options.length > 0) this.pullPath = this.pullPath + '?' + options.join('&');
        this.pullUrl.innerHTML = `<a href="${this.host}${this.pullPath}" target="pull">${this.host}${this.pullPath}</a>`;
    }
    writeInstructions() {
        this.instructions.innerHTML = `
<b>Explore:</b> Use ping and pull to create and present real time data.
Choose a namespace and then select from available attributes defined to the
namespace, or enter and ad hoc name. Sample is a public namespace that can be
used as a sandbox if none other are defined to your account.
<a href="/#Wiki/MetricReference">Reference Documentation</a>
`
    }
    async ping() {
        await API.get(this.pingPath);
        this.pingUrl.classList.add('active')
        setTimeout(()=>{this.pingUrl.classList.remove('active')},200);
    }
    async pull() {
        if (this.data.dimensions.length > 0 && this.data.metrics.length > 0) {
            this.resultFrame.src = this.pullPath;
            this.pullUrl.classList.add('active')
            setTimeout(()=>{this.pullUrl.classList.remove('active')},200);
        } else {
            window.toast.warning('Please provide at least one dimension and metric')
        }
    }
    clear() {
        sessionStorage.clear('exploredata');
        this.data = this.base_data;
        this.update();
    }
}
