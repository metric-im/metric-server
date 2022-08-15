import Parser from './Parser.mjs';

export default class DimPath {
    constructor(fieldMap,connector) {
        this.connector = connector;
        this.fieldMap = fieldMap;
        this.dimensions = [];
        this.metrics = [];
        this._ASSIGN = "assign";
        this._OBJECTIFY = "objectify";
        this._COMPRESS = "compress";
        this._SPREAD = "spread";
        this._COMBINE = "combine";
        this._SKIP = "skip";
    }
    get hasCompressors() {
        return this.dimensions.some(d=>d.compressor);
    }
    parse(dimensions=[],metrics=[]) {
        // parse metrics
        this.metrics = this.smartSplit(metrics).map(k => {
            let match = k.match(/^([A-Za-z0-9-_.]+)[:]?(.*)/);
            let nameArgs = match[1].split('.').map(a=>(this.fieldMap[a]?this.fieldMap[a]:a));
            let name = nameArgs.shift();
            let methodArgs = match[2]?match[2].split('.'):[];
            let method = methodArgs.length>0?methodArgs.shift():(name.accumulator || 'sum');
            return {name: name._id||name, nameArgs:nameArgs, method: method, methodArgs:methodArgs, field:(typeof name==='object')?name:null}
        });
        // parse dimensions
        this.dimensions = this.smartSplit(dimensions).map(k=>{
            let match = k.match(/^([@+><!])?([A-Za-z0-9-_.]+)[:]?(.*)/);
            let compressor = null;
            if (match[1]==='@') compressor=this._ASSIGN;
            else if (match[1]==='+') compressor=this._COMBINE;
            else if (match[1]==='<') compressor=this._COMPRESS;
            else if (match[1]==='>') compressor=this._SPREAD;
            else if (match[1]==='!') compressor=this._SKIP;
            let nameArgs = match[2].split('.').map(a=>(this.fieldMap[a]?this.fieldMap[a]:a));;
            let name = nameArgs.shift();
            return {name:name._id||name,nameArgs:nameArgs,value:match[3],compressor:compressor,field:(typeof name==='object')?name:null,filters:[]};
        });
        // construct dimension filters
        for (let key of this.dimensions) {
            if (key.value) {
                let matchRange = key.value.match(/^([A-Za-b0-9-_]*)~(.*)$/);
                if (matchRange) {
                    if (matchRange[1]) key.filters.push({[key.name]:{$gte:this.parseValue(key.name,matchRange[1])}});
                    if (matchRange[2]) key.filters.push({[key.name]:{$lte:this.parseValue(key.name,matchRange[2])}});
                    continue;
                }
                let matchMongo = key.value.match(/^(\{.+\})$/);
                if (matchMongo) {
                    let obj = Parser.objectify(matchMongo[1]);
                    key.filters.push({[key.name]:obj});
                    continue;
                }
                let matchSet = key.value.match(/^(\[.+\])$/);
                if (matchSet) {
                    let obj = Parser.objectify(`{$in:${matchSet[1]}}`);
                    key.filters.push({[key.name]:obj});
                    continue;
                }
                key.filters.push({[key.name]:this.parseValue(key.name,key.value)});
            }
        }
        this.filters = this.dimensions.reduce((r,d)=>{return r.concat(d.filters)},[]);
        if (this.filters.length > 1) this.filters = {$and:this.filters};
        else if (this.filters.length > 0) this.filters = this.filters[0];
        else this.filters = {};
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
                    //TODO: This has become a mess. params on dimensions are not working out cleanly.
                    let availableFields = this.dimensions.concat(this.metrics);
                    let baseField = availableFields.find(af=>af.name===field._id);
                    if (baseField) inputs = inputs.concat(baseField.nameArgs);
                    return {$set:{[field._id]:{$function:{body:field[codeAttribute], args:inputs, lang:"js"}}}};
                }
            }
        } catch(e) {
            throw new Error(`Could not parse ${codeAttribute} field ${field.name}, ${e.message}`);
        }
    }
    organize(data) {
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
        return this.arrange(this.dimensions, organized);
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
