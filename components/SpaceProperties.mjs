import Component from "./Component.mjs";
import {InputID,InputText} from "./InputText.mjs";
import {InputSelect} from "./InputSelect.mjs";
import WikiBlock from "./WikiBlock.mjs";
import ObjectSelector from "./ObjectSelector.mjs";
import API from "./API.mjs";

export default class SpaceProperties extends Component {
    constructor(props) {
        super(props);
    }
    async render(element) {
        await super.render(element)
        if (!this.props.data) {
            this.element.innerHTML = "<i>Select a name space</i>";
            return;
        }
        let namespaces = await API.get('/ontology/ns');
        namespaces = namespaces.map(ns=>ns._id);
        let propertySet = this.div('property-set',this.element);
        this.inputId = this.new(InputID,{
            data:this.props.data,name:"_id",placeholder:"Enter identifier",hideTitle:true
        });
        await this.inputId.render(propertySet);
        if (!this.props.data._pid) this.props.data._pid = "root";
        this.inputPid = this.new(InputSelect,{
            data:this.props.data,name:"_pid",placeholder:"Enter parent name space",hideTitle:true,
            options:namespaces.filter(ns=>ns!==this.props.data._id)
        });
        await this.inputPid.render(propertySet);
        this.inputAvailability = this.new(InputSelect,{
            name:"availability",hideTitle:true,options:['public','private','licensed'],data:this.props.data
        });
        this.inputTimezone = this.new(InputSelect,{
            name:"timezone",options:[''].concat(moment.tz.names()),data:this.props.data
        });
        this.refinery = this.new(ObjectSelector,{data:this.props.data,name:"refinery",title:"Refinery",path:"/ontology/refinery"});
        let propertySet2 = this.div('properties',this.element);
        let propertySet3 = this.div('properties',this.element);

        await this.inputAvailability.render(propertySet);
        await this.inputTimezone.render(propertySet2);
        await this.refinery.render(propertySet3);
        this.inputDescription = this.new(WikiBlock,{data:this.props.data,name:"description"});
        await this.inputDescription.render(this.element);
    }
}