import Component from "./Component.mjs";
import {InputID,InputText} from "./InputText.mjs";
import {InputSelect} from "./InputSelect.mjs";
import {InputToggle} from "./InputToggle.mjs";
import TableWidget from "./TableWidget.mjs";
import TabWidget from "./TabWidget.mjs";
import CodeBlock from "./CodeBlock.mjs";
import WikiBlock from "./WikiBlock.mjs"
import WikiParser from "./WikiParser.mjs"
import API from "./API.mjs";

export default class SpaceFields extends Component {
    constructor(props) {
        super(props);
        this.field = null;  // selected field
        this.hub = true;
        this.accumulators = null;
    }
    async render(element) {
        await super.render(element);
        this.field = null;
        if (!this.props.data) {
            this.element.innerHTML = "<i>Select a name space</i>";
            return;
        } else {
            await this.getAccumulators();
        }
        if (!this.props.data.fields) this.props.data.fields = [];

        // add derived columns
        for (let field of this.props.data.fields) {
            field.__summary = WikiParser.summarize(field.description||"");
            let scripts = [];
            if (field.derive) scripts.push("derive");
            if (field.project) scripts.push("project");
            field.__scripts = scripts.join(', ');
        }
        this.table = this.new(TableWidget,{
            name:'fields',
            columns:[
                {name:'_id',title:'Name',style:'width:20%',placeholder:"new field"},
                {name:'dataType',title:'Data Type',style:'width:15%'},
                {name:'__scripts',title:'Scripts',style:'width:15%'},
                {name:'__summary',title:'Summary',style:'width:50%'}],
            data:this.props.data.fields,
            onSelect:this.selectField.bind(this)
        });
        this.table.render(this.element);

        // add field property details
        this.details = this.div('properties');
        await this.renderProperties();
    }
    async renderProperties() {
        if (!this.field) {
            this.details.innerHTML = "<i>select a field</a>";
            return;
        } else this.details.innerHTML = "";
        this.propertySet = this.div('property-set',this.details);
        this.propertySet2 = this.div('property-set',this.details);
        this.inputId = this.new(InputText,{data:this.field,name:"_id",title:"Field Name"});
        this.inputTitle = this.new(InputText,{data:this.field,name:"title",title:"Display Title"});
        this.inputType = this.new(InputSelect,{
            name:"dataType",title:"Data Type",data:this.field,options:[
                'string','integer','float','date','boolean','currency','array','other'
            ]});
        this.inputAccumulator = this.new(InputSelect,{
            name:"accumulator",title:"Accumulator",data:this.field,options:Object.keys(this.accumulators)});
        this.inputInterpreter = this.new(InputSelect,{
            name:"interpreter",data:this.field,options:['javascript','json']
        });

        await this.inputId.render(this.propertySet);
        await this.inputTitle.render(this.propertySet);
        await this.inputType.render(this.propertySet2);
        await this.inputAccumulator.render(this.propertySet2);
        await this.inputInterpreter.render(this.propertySet2);

        this.inputDescription = this.new(WikiBlock,{data:this.field,name:"description"});
        this.inputDeriveScript = this.new(CodeBlock,{data:this.field,name:"derive",theme:'dawn',interpreter:'javascript'});
        this.inputProjectScript = this.new(CodeBlock,{data:this.field,name:"project",theme:'dawn',interpreter:'javascript'});
        this.propTabs = this.new(TabWidget,{tabs:[
            {title:'Description',component:this.inputDescription},
            {title:'Derive Script',component:this.inputDeriveScript},
            {title:'Project Script',component:this.inputProjectScript}
        ]});
        await this.propTabs.render(this.details)

        this.inputId.element.focus();
    }
    async selectField(data) {
        this.field = data;
        this.props.alignButtons();
        await this.renderProperties();
    }
    async selectLast() {
        let last = this.props.data.fields[this.props.data.fields.length-1];
        await this.selectField(last)
    }
    async handleUpdate(attributeName) {
        if (attributeName === 'interpreter') {
            await this.inputDeriveScript.update();
            await this.inputProjectScript.update();
        } else {
            await super.handleUpdate(attributeName);
            if (attributeName === 'fields' || attributeName === 'description') await this.update();
        }
    }
    async addField() {
        this.props.data.fields.push({dataType:'string',accumulator:'',description:""});
        await this.announceUpdate('fields');
        setTimeout(this.table.selectLast.bind(this.table),100);
    }
    async removeField() {
        if (this.props.data.fields) {
            this.props.data.fields = this.props.data.fields.filter(row=>row._id !== this.field._id);
        }
        await this.announceUpdate('fields');
    }
    async getAccumulators() {
        this.accumulators = await API.get(`/ontology/ns/${this.props.data._id}/accumulators`);
    }
}