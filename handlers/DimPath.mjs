import Parser from './Parser.mjs';
import Ontology from './Ontology.mjs';
import moment from 'moment';

export default class DimPath {
    constructor(connector) {
        this.connector = connector;
        this.ontology = new Ontology(connector);
        this.dimensions = [];
        this.metrics = [];
        this.foreignCollections = []; // $lookup only works with collections in this set
        this._ASSIGN = "assign";
        this._OBJECTIFY = "objectify";
        this._COMPRESS = "compress";
        this._SPREAD = "spread";
        this._COMBINE = "combine";
        this._SKIP = "skip";
    }
    static async mint(connector,account,path) {
        let instance = new DimPath(connector);
        instance.accumulators = {};
        instance.fieldMap = {};
        for (let ns of path.namespaces) {
            ns = await instance.ontology.nameSpace.get(account,ns,1);
            if (!ns) throw(new Error("Namespace unknown"));
            Object.assign(instance.accumulators,await instance.ontology.nameSpace.accumulators(account,ns));
            // parse fieldMap from the namespaces requested (usually just one)
            Object.assign(instance.fieldMap,await instance.ontology.nameSpace.fields(account,ns));
        }
        instance.parse(path.dimensions,path.metrics);
        return instance;
    }
    get hasCompressors() {
        return this.dimensions.some(d=>d.compressor);
    }
    parse(dimensions=[],metrics=[]) {
        // parse metrics
        this.metrics = this.smartSplit(metrics).map(k => {
            let match = k.match(/^([A-Za-z0-9-_.]+)[:]?(.*)/);
            let field = this.fieldMap[match[1]] || {_id:match[1]};
            field.accumulator = match[2] || field.accumulator || 'sum';
            field.methodArgs = field.accumulator.split('.');
            field.name = field.methodArgs.shift()
            return {name: field._id, method: field.accumulator, methodArgs:field.methodArgs, field:this.fieldMap[field._id]}
        });
        // parse dimensions
        this.dimensions = this.smartSplit(dimensions).map(k=>{
            let match = k.match(/^([@+><!])?([A-Za-z0-9-_.]+)([~:]?)(.*)/);
            let compressor = null;
            if (match[1]==='@') compressor=this._ASSIGN;
            else if (match[1]==='+') compressor=this._COMBINE;
            else if (match[1]==='<') compressor=this._COMPRESS;
            else if (match[1]==='>') compressor=this._SPREAD;
            else if (match[1]==='!') compressor=this._SKIP;
            let modifier = match[3]?(match[3]==='~'?'series':'match'):null;
            return {name:match[2],modifier,value:match[4],compressor:compressor,field:this.fieldMap[match[2]],filters:[]};
        });
        // Apply dimension modifiers
        for (let key of this.dimensions) {
            if (!key.value) continue;
            if (key.modifier==='match') {
                // Problematic and rarely used. Apply where clauses instead
                // let matchRange = key.value.match(/^([A-Za-b0-9-_]*)~(.*)$/);
                // if (matchRange) {
                //     let stage = {$match:{}}
                //     if (matchRange[1]) stage.$match[key.name] = {$gte:this.parseValue(key.name,matchRange[1])};
                //     if (matchRange[2]) stage.$match[key.name] = {$lte:this.parseValue(key.name,matchRange[2])};
                //     key.filters.push(stage);
                //     continue;
                // }
                let matchMongo = key.value.match(/^(\{.+\})$/);
                if (matchMongo) {
                    let obj = Parser.objectify(matchMongo[1]);
                    key.filters.push({priority:1,statement:{$match:{[key.name]:obj}}});
                    continue;
                }
                let matchSet = key.value.match(/^(\[.+\])$/);
                if (matchSet) {
                    let obj = Parser.objectify(`{$in:${matchSet[1]}}`);
                    key.filters.push({priority:1,statement:{$match:{[key.name]:obj}}});
                    continue;
                }
                let matchLookup = key.value.match(/^\((.+)\)$/);
                if (matchLookup) {
                    let params = matchLookup[1].split(',');
                    let collection = params.shift();
                    if (!this.foreignCollections.includes(collection)) continue;
                    if (params.length===0) params.unshift('name'); // default field to project
                    params = params.reduce((r,o)=>{r[key.name+'.'+o]=1;return r},{})
                    key.filters.push({priority:2,statement:{$lookup:{from:collection,localField:key.name,foreignField:'_id',as:key.name}}});
                    key.filters.push({priority:2,statement:{$project:params}});
                    key.filters.push({priority:2,statement:{$unwind:'$'+key.name}});
                    continue;
                }
                key.filters.push({priority:1,statement:{$match:{[key.name]:this.parseValue(key.name,key.value)}}});
            } else if (key.modifier==='series') {
                if (key.field?.dataType === 'date') {
                    let valueArgs = key.value.split('.');
                    let [original,step,unit] = valueArgs.shift().match(/(\d*)(.*)/);
                    key.filters.push({priority:3,statement:{$set:{[key.name]:{$dateTrunc:{date:`$`+key.name,unit:unit}}}}});
                    let fillArg = (valueArgs.shift()||"").match(/(linear|locf|)fill/i);
                    if (fillArg) {
                        let method = fillArg[1] || 'locf';
                        let densify = { field: key.name, range: { step: step?Number(step):1, unit: unit, bounds : "full"}}
                        key.filters.push({priority:5,statement:{$densify: densify}});
                        let fill = {output:{},sortBy:{[key.name]:1}}
                        for (let fillkey of this.dimensions) if (fillkey.name !== key.name) fill.output[fillkey.name]={method:'locf'};
                        for (let fillkey of this.metrics) fill.output[fillkey.name]={method:method};
                        key.filters.push({priority:6,statement:{$fill: fill}});
                    }
                    // Dates used in series are very likely to anchor graphs and tables, so enable casting to readable strings
                    if (!key.field?.project || key.field?.project === '') {
                        key.project = (value)=>{
                            let formatting = {
                                year:'YYYY',
                                quarter:'YY[Q]Q',
                                week:'YY[W]W',
                                month:'YYYY-MM',
                                day:'YYYY-MM-DD',
                                hour:'MM-DD HH:00',
                                minute:'MM-DD HH:mm',
                                second:'HH:mm:ss',
                                millisecond:'HH:mm:ss.SSS',
                            }
                            return moment(value).format(formatting[unit]);
                        }
                    }
                } else if (['integer','float','currency'].includes(key.field?.dataType)) {
                    let valueArgs = key.value.split('.');
                    let step = Number(valueArgs.shift());
                    let fill = (valueArgs.shift()||"").match(/fill/i);
                    key.filters.push({priority:3,statement:{$set:{[key.name]:{$multiply:[{$round:{$divide:['$'+key.name,step]}},step]}}}});
                    if (fill) {
                        let densify = { field: key.name, range: { step: step, bounds : "full"}}
                        key.filters.push({priority:5,statement:{$densify: densify}});
                        let fill = {output:{},sortBy:{[key.name]:1}}
                        for (let fillkey of this.dimensions) if (fillkey.name !== key.name) fill.output[fillkey.name]={method:'locf'};
                        for (let fillkey of this.metrics) fill.output[fillkey.name]={method:'locf'};
                        key.filters.push({priority:6,statement:{$fill: fill}});
                    }
                }
            }
        }
        this.filters = this.dimensions.reduce((r,d)=>{return r.concat(d.filters)},[]);
        this.filters.sort((a,b)=>{return a.priority - b.priority});
    }

    /**
     * Split a string by commas ignoring blocks in brackets.
     * [] {} () can be used. It is assumed that each set is properly opened and closed.
     * @param data
     */
    smartSplit(data) {
        let result = [];
        let item = "";
        let depth = 0;
        for (let char of data) {
            if ("{[(".indexOf(char) >= 0) depth++;
            if ("}])".indexOf(char) >= 0) depth--;
            if (depth === 0) {
                if (char === ",") {
                    result.push(item);
                    item = "";
                    continue;
                }
            }
            item = item + char;
        }
        if (item) result.push(item);
        return result;
    }
    expandDerivedFields() {
        let result = [];
        for (let field of this.dimensions.concat(this.metrics)) {
            if (field.field && field.field.derive) {
                result.push(this.expandCode(field.field,"derive"));
            }
        }
        return result;
    }
    expandProjectedFields() {
        let result = [];
        for (let field of this.dimensions.concat(this.metrics)) {
            if (field.field && field.field.project) {
                result.push(this.expandCode(field.field,"project"));
            }
        }
        return result;
    }
    expandCode(field,codeAttribute) {
        try {
            if (field.interpreter==='json') {
                return {$set:{[field.name]:Parser.objectify(field[codeAttribute])}};
            } else { // default to javascript
                let inputs = field[codeAttribute].match(/^function(?:\W*?)\((.*)\)/);
                if (inputs) {
                    inputs = inputs[1].split(',').reduce((r,a)=>{
                        r.push('$'+a);
                        return r;
                    },[]);
                    return {$set:{[field._id]:{$function:{body:field[codeAttribute], args:inputs, lang:"js"}}}};
                }
            }
        } catch(e) {
            throw new Error(`Could not parse ${codeAttribute} field ${field.name}, ${e.message}`);
        }
    }
    organize(data,options) {
        if (this.dimensions.length === 0 || data.length === 0) return data;
        data = data.sort((a, b) => {
            for (let dim of this.dimensions) {
                if (!a[dim.name]) return -1;
                else if (!b[dim.name]) return 1;
                else if (a[dim.name] < b[dim.name]) return -1;
                else if (a[dim.name] > b[dim.name]) return 1;
            }
            return 0;
        });
        let organized = [];
        let metrics = Object.keys(data[0]).filter(key => !this.dimensions.find(dim => dim.name === key));
        for (let record of data) {
            let resultRecord = {};
            // null is applied rather than 'undefined' so the attribute is acknowledged
            for (let dim of this.dimensions) resultRecord[dim.name] = record[dim.name] || null;
            for (let metric of metrics) resultRecord[metric] = record[metric];
            organized.push(resultRecord);
        }
        let result = this.arrange(this.dimensions, organized);
        if (options.fill) result = this.fill(result,options);
        return result;
    }
    compress(dimensions,data) {
        let dims = dimensions.reduce((r,dim)=>{r[dim.name]=dim;return r},{});
        return data.map(record=>{
            let result = {};
            let nkey = "";
            let nval = ""
            for (let [key,val] of Object.entries(record)) {
                if (dims[key] && dims[key].compressor === this._COMPRESS) {
                    nkey += (nkey?".":"")+key;
                    nval += (nval?".":".")+val;
                } else {
                    if (nval) result[nkey+"."+key]=nval+"."+val;
                    else result[key] = val;
                    if (dims[key]) {
                        nkey = "";
                        nval = "";
                    }
                }
            }
            return result;
        })
    }

    /**
     * Spread metrics through empty/missing values
     * @param data
     */
    fill(data,options) {
        let lov = {};
        for (let record of data) {
            Object.assign(lov,record);
            for (let attribute in lov) {
                if (!record[attribute]) record[attribute] = lov[attribute];
            }
        }
        return data;
    }

    arrange(dimensions,data) {
        let dimStack = [];
        dimStack.push([]);
        dimStack[0].push({});
        dimStack.push(dimStack[0][0]);
        let pinRecord = {};
        let index = 0;
        while (index < data.length) {
            let record = data[index];
            let col = 0;
            let pinDepth = 0;
            let spreadBase = null;
            for (let [key, value] of Object.entries(record)) {
                let dim = dimensions[col];
                if (dim) {
                    if (dim.compressor === this._ASSIGN) {
                        if (value !== pinRecord[key]) {
                            this.clearStackTop(dimStack);
                            dimStack = dimStack.slice(0, ((++pinDepth) * 2));
                            let newSet = [{}];
                            if (!dimStack[dimStack.length - 1][key]) dimStack[dimStack.length - 1][key] = {};
                            dimStack[dimStack.length - 1][key][value] = newSet;
                            dimStack.push(newSet)
                            dimStack.push(newSet[0]);
                        }
                        pinRecord = dimensions.reduce((r, dim, n) => {
                            if (n <= col) r[dim.name] = record[dim.name];
                            return r;
                        }, {});
                    } else if (dim.compressor === this._OBJECTIFY) {
                        if (value !== pinRecord[key]) {
                            this.clearStackTop(dimStack);
                            dimStack = dimStack.slice(0, ((++pinDepth) * 2));
                            let newSet = [{}];
                            if (!dimStack[dimStack.length - 1][value]) dimStack[dimStack.length - 1][value] = {};
                            dimStack[dimStack.length - 1][value] = newSet;
                            dimStack.push(newSet)
                            dimStack.push(newSet[0]);
                        }
                        pinRecord = dimensions.reduce((r, dim, n) => {
                            if (n <= col) r[dim.name] = record[dim.name];
                            return r;
                        }, {});
                    } else if (dim.compressor === this._SPREAD) {
                        dimStack[dimStack.length - 1][key] = value;
                        spreadBase = Object.assign({},dimStack[dimStack.length - 1]);
                    } else if (dim.compressor === this._COMPRESS) {
                        if (value !== pinRecord[key]) {
                            this.clearStackTop(dimStack);
                            dimStack = dimStack.slice(0,((++pinDepth)*2));
                            let slice = this.sliceDimension(dimensions,data,index,col);
                            let sliceDimensions = dimensions.reduce((r,dim,n)=>{
                                if (n===col) r.push(Object.assign({},dim,{compressor:null}));
                                else if (n>col) r.push(dim);
                                return r;
                            },[]);
                            let newSet = this.arrange(sliceDimensions,slice);
                            let nextDim = sliceDimensions[col+1];
                            let restCompressed = sliceDimensions.every(dim=>dim.compressor===this._COMPRESS);
                            let mappedSet = newSet.reduce((r,row)=>{
                                let dimKey = row[dim.name];
                                delete row[dim.name];
                                if (nextDim) {
                                    let nextKey = Object.keys(row)[0]; // works with compressed keys as well
                                    if (nextDim.compressor === this._COMPRESS) {
                                        if (restCompressed) r[dimKey+"."+row[nextKey]] = Object.values(row)[0];
                                        else for (let [k,v] of Object.entries(row)) r[dimKey+"."+k] = v;
                                    }
                                    else r[dimKey+"."+row[nextKey]] = row;
                                    delete row[nextKey];
                                }
                                else for (let [k,v] of Object.entries(row)) r[dimKey+"."+k] = v;
                                return r;
                            },{});
                            Object.assign(dimStack[dimStack.length-1],mappedSet);
                            index+=slice.length-1;
                            break;
                        }
                        pinRecord = dimensions.reduce((r,dim,n)=>{
                            if (n <= col) r[dim.name] = record[dim.name];return r;
                        },{});
                    } else if (dim.compressor === this._SKIP) {
                        // bypass this attribute
                    } else {
                        if (Object.keys(pinRecord).includes(key)) {
                            if (value !== pinRecord[key]) {
                                if (Object.keys(dimStack[dimStack.length-1]).length===0) {
                                    dimStack[dimStack.length-2].pop();
                                }
                                dimStack = dimStack.slice(0,(col*2)+1);
                                let newSet = {[key]:value};
                                dimStack[dimStack.length-1].push(newSet);
                                dimStack.push(newSet);
                                pinRecord = {};
                            }
                        } else {
                            dimStack[dimStack.length - 1][key] = record[key];
                        }
                    }
                } else {
                    if (spreadBase && Object.keys(spreadBase).length < col) {
                        dimStack.pop();
                        let slot = Object.assign({},spreadBase);
                        dimStack[dimStack.length-1].push(slot);
                        dimStack.push(slot);
                    }
                    dimStack[dimStack.length-1][key] = record[key];
                }
                col++;
            }
            dimStack.pop();
            let slot = {};
            dimStack[dimStack.length-1].push(slot);
            dimStack.push(slot);
            index++;
        }
        this.clearStackTop(dimStack);
        return dimStack[0];
    }
    clearStackTop(stack) {
        if (Object.keys(stack[stack.length-1]).length===0 && stack[stack.length-2].length > 1) {
            stack[stack.length-2].pop();
        }
    }
    sliceDimension(dimensions,data,index,col) {
        let baseValue = data[index];
        let result = [];
        while (index < data.length) {
            if (dimensions.slice(0,col).some(dim=>data[index][dim.name] !== baseValue[dim.name])) break;
            result.push(Object.keys(data[index]).reduce((r, k, n) => {
                if (n >= col) r[k] = data[index][k];
                return r;
            }, {}));
            index++;
        }
        return result;
    }
    /**
     * When we don't know if the string is intended to be a string or a number we
     * cast to a number if either an integer or float, otherwise leave as a string.
     * When one needs to explicitly match a numeral that is a string, use a mongo
     * statement.
     *
     * @param name of the field
     * @param value provided in request
     * @returns {number|*}
     */
    parseValue(name,val) {
        let type = this.fieldMap[name]?this.fieldMap[name].dataType:null;
        if (['string','date','bool'].includes(type)) return val;
        else if (['int','long','double','decimal'].includes(type)) return Number(val);
        // else guess
        else return (/^[.0-9]*$/.test(val))?Number(val):val;
    }
}
