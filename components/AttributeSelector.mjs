import Component from "./Component.mjs";
import {InputText} from "./InputText.mjs";
import {InputSelect} from "./InputSelect.mjs";
import API from './API.mjs';
import {Button} from "./Button.mjs";

export default class AttributeSelector extends Component {
    constructor(props) {
        super(props);
    }
    async render(element) {
        await super.render(element);
        this.attributeNames = Object.keys(this.props.data.allAttributes).map(a=>this.props.data.allAttributes[a]._id);
        if (this.props.extraOptions) this.attributeNames = this.props.extraOptions.concat(this.attributeNames);

        if (!this.props.hideTitle) {
            this.title = this.div('form-element-title');
            this.title.innerHTML = this.props.title || this.props.name;
        }
        this.tray = this.div('tray');
        this.container = this.div('container',this.tray);
        this.container.style.marginRight=0;
        this.props.data[this.props.name].map((item,idx)=>{
            let elem = this.div('item',this.container);
            elem.innerHTML = item.name;
            if (this.props.includeValue) elem.innerHTML+='='+item.value;
            else if (this.props.includeModifier && item.value) elem.innerHTML+=':'+item.value;
            elem.addEventListener('click',()=>{
                this.editTarget(idx);
            })
        });
        this.control = this.div('control',this.tray);
        this.control.innerHTML = "<span class='icon icon-plus'></span>";
        this.control.addEventListener('click',this.editTarget.bind(this,-1));
        if (this.props.action) {
            this.actionButton = await this.new(Button,{title:this.props.action.name,onClick:this.props.action.method});
            await this.actionButton.render(this.tray);
        }
    }
    async editTarget(idx) {
        let editor = document.createElement('div');
        editor.classList.add('popup-form');
        let nameSelector = this.new(InputText,{
            name:"name",data:idx>=0?this.props.data[this.props.name][idx]:{},options:this.attributeNames
        });
        await nameSelector.render(editor);
        let valueInput = null;
        if (this.props.includeValue || this.props.includeModifier) {
            let title = this.props.includeValue?"value":"modifier";
            valueInput = this.new(InputText,{
                name:"value",data:idx>=0?this.props.data[this.props.name][idx]:{},title:title,options:this.props.modifierOptions
            });
            await valueInput.render(editor);
        }
        let btnOk = this.new(Button,{title:"ok",icon:"check",onClick:async ()=>{
            if (idx<0 && nameSelector.value) {
                let entry = {name:nameSelector.value}
                if (this.props.includeValue || this.props.includeModifier) entry.value = valueInput.value;
                this.props.data[this.props.name].push(entry);
            }
            window.popup.close();
            await this.announceUpdate(this.props.name);
            await this.update();
        }});
        let btnCancel = this.new(Button,{title:"cancel",icon:"cross",onClick:()=>{
            window.popup.close();
        }});
        let btnRemove = this.new(Button,{title:"remove",icon:"trash",onClick:async ()=>{
            if (idx>=0) this.props.data[this.props.name].splice(idx,1);
            window.popup.close();
            await this.update();
        }});
        await window.popup.display("attribute",editor,[btnOk,btnCancel,btnRemove]);
    }
    async handleUpdate(attributeName) {
        await super.handleUpdate(attributeName);
        if (attributeName === this.props.name) await this.update();
    }
}