import Component from "./Component.mjs";
import TableWidget from "./TableWidget.mjs";
import TabWidget from "./TabWidget.mjs";
import SpaceProperties from "./SpaceProperties.mjs";
import SpaceFields from "./SpaceFields.mjs";
import {Button} from "./Button.mjs";
import API from "./API.mjs";

export default class Ontology extends Component {
    constructor(props) {
        super(props);
        this.spaceProperties = null;
        this.space = null;  // selected name space
        this.spaces = []    // name spaces defined to this account
        this.buttons = {};
        this.hub = true;
    }
    async render(element) {
        await super.render(element);
        if (!this.props.namespace) {
            await this.update();
            let nameSpacesBlock = this.div('ontology-spaces');
            let nameSpacesList = this.div('page-content',nameSpacesBlock);
            this.nameSpacesTable = new TableWidget({columns:[
                {name:"_id",title:"Event Name Space",placeholder:"new name space"}
            ],data:this.spaces,onSelect:this.selectSpace.bind(this)});
            await this.nameSpacesTable.render(nameSpacesList);
            let nameSpacesControls = this.div('page-controls space-controls',nameSpacesBlock);
            /*ACL>2*/
            this.buttons.removeSpaceButton = await this.new(Button,{title:'remove',icon:'trash',onClick:this.removeSpace.bind(this)});
            await this.buttons.removeSpaceButton.render(nameSpacesControls);
            /*ENDACL*/
            /*ACL>1*/
            this.buttons.newSpaceButton = await this.new(Button,{title:'new',icon:'circle-with-plus',onClick:this.addSpace.bind(this)});
            await this.buttons.newSpaceButton.render(nameSpacesControls);
            /*ENDACL*/
        }

        let detailsBlock = this.div('ontology-details');
        let detailsBlockContent = this.div('page-content',detailsBlock);
        this.spaceProperties = this.new(SpaceProperties,{context:this.props.context,data:this.space});
        this.spaceFields = this.new(SpaceFields,{context:this.props.context,data:this.space,alignButtons:this.alignButtons.bind(this)});
        let detailTabs = new TabWidget({tabs:[
            {title:'Properties',component:this.spaceProperties},
            {title:'Fields',component:this.spaceFields}
        ]});
        await detailTabs.render(detailsBlockContent);

        /*ACL>1*/
        // add field control buttons
        let detailControls = this.div('page-controls',detailsBlock);
        this.buttons.saveButton = await this.new(Button,{title:'save',icon:'save',onClick:this.save.bind(this)});
        await this.buttons.saveButton.render(detailControls);
        this.buttons.newFieldButton = await this.new(Button,{title:'new',icon:'circle-with-plus',onClick:this.addField.bind(this)});
        await this.buttons.newFieldButton.render(detailControls);
        this.buttons.removeFieldButton = await this.new(Button,{title:'remove',icon:'trash',onClick:this.removeField.bind(this)});
        await this.buttons.removeFieldButton.render(detailControls);
        this.alignButtons();
        /*ENDACL*/

        if (this.props.namespace) {
            let ns = await API.get('/ontology/ns/'+this.props.namespace);
            this.selectSpace(ns);
        }
    }
    async update(reload=true) {
        if (reload) this.spaces = await API.get('/ontology/ns');
        this.spaces = this.spaces.map(o=>({...o,_selected:false}));
    }
    async selectSpace(data) {
        this.space = data;
        await this.spaceProperties.update({data:this.space});
        await this.spaceFields.update({data:this.space});
        this.alignButtons();
    }
    alignButtons() {
        /*ACL>1*/
        if (!this.props.namespace) {
            if (!this.space) {
                this.buttons.saveButton.hide();
                this.buttons.newFieldButton.hide();
            } else {
                this.buttons.saveButton.show();
                this.buttons.newFieldButton.show();
            }
        }
        if (!this.spaceFields.field) {
            this.buttons.removeFieldButton.hide();
        } else {
            this.buttons.removeFieldButton.show();
        }
        /*ENDACL*/
        /*ACL>2*/
        if (!this.props.namespace) {
            if (!this.space) {
                this.buttons.removeSpaceButton.hide();
            } else {
                this.buttons.removeSpaceButton.show();
            }
        }
        /*ENDACL*/
    }
    async handleUpdate(attributeName) {
        await super.handleUpdate(attributeName);
        if (this.nameSpacesTable) await this.nameSpacesTable.update();
        this.alignButtons();
    }
    async addSpace() {
        this.spaces.push({_pid:"root",availability:"private",fields:[]});
        this.space = this.spaces[this.spaces.length-1];
        await this.announceUpdate();
    }
    async removeSpace() {
        try {
            await API.remove('/ontology/ns/'+this.space._id);
            await this.render();
            window.toast.success('removed');
        } catch(e) {
            window.toast.error(e);
        }
    }
    /*ACL>1*/
    async save() {
        try {
            if (await this.lock.test('save')) {
                this.scrub(this.space);
                await API.put('/ontology/ns/'+this.space._id,this.space);
                window.toast.success('saved');
            }
        } catch(e) {
            window.toast.error(e.response?e.response.message:e);
        }
    }
    async addField() {
        if (!this.space) return;
        await this.spaceFields.addField();
    }
    async removeField() {
        await this.spaceFields.removeField();
    }
    /*ENDACL*/
}
