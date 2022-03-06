const Parser = require("./Parser");

class DimPath {
    constructor(fieldMap,sort) {
        this.fieldMap = fieldMap;
        this.sort = sort || {};
        this.dimensions = [];
        this._ASSIGN = "assign";
        this._COMPRESS = "compress";
        this._SKIP = "skip";
    }
    get hasCompressors() {
        return this.dimensions.some(d=>d.compressor);
    }
    parse(data=[]) {
        if (typeof data === 'string') data = this.smartSplit(data);
        // parse dimension syntax for display and filter
        this.dimensions = data.map(k=>{
            let match = k.match(/^([@+!])?([A-za-z0-9-_]+)[:]?(.*)/);
            let compressor = null;
            if (match[1]==='@') compressor=this._ASSIGN;
            else if (match[1]==='+') compressor=this._COMPRESS;
            else if (match[1]==='!') compressor=this._SKIP;
            return {name:match[2],value:match[3],compressor:compressor,filters:[]};
        });

        // construct filters
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
    organize(data) {
        if (this.dimensions.length === 0 || data.length === 0) return data;
        data = data.sort((a,b)=>{
            for (let dim of this.dimensions) {
                if (a[dim.name]<b[dim.name]) return -1;
                else if (a[dim.name]>b[dim.name]) return 1;
            }
            return 0;
        });
        let organized = [];
        let compressed = {};
        let metrics = Object.keys(data[0]).filter(key=>!this.dimensions.find(dim=>dim.name===key));
        for (let record of data) {
            let resultRecord = {};
            // null is applied rather than 'undefined' so the attribute is acknowledged
            for (let dim of this.dimensions) resultRecord[dim.name] = record[dim.name]||null;
            for (let metric of metrics) resultRecord[metric] = record[metric];
            organized.push(resultRecord);
            let key = compressed
            for (let dim of this.dimensions) {
                if (!key[record[dim.name]]) key[record[dim.name]] = {};
                key = key[record[dim.name]];
            }
            for (let metric of metrics) key[metric] = record[metric];
        }
        let index = 0;
        return arrange.call(this,organized);

        function arrange(data,depth=0) {
            let dimStack = [];
            dimStack.push([]);
            dimStack[0].push({});
            dimStack.push(dimStack[0][0]);
            let pinRecord = {};
            // let hotRecord = this.dimensions.reduce((r,dim)=>{
            //     r[dim.name] = data[0][dim.name];return r;
            // },{});
            while (index < data.length) {
                let record = data[index];
                let col = 0;
                let pinDepth = 0;
                for (let [key, value] of Object.entries(record)) {
                    let dim = this.dimensions[col];
                    if (dim) {
                        if (dim.compressor === this._ASSIGN) {
                            if (value !== pinRecord[key]) {
                                if (Object.keys(dimStack[dimStack.length-1]).length===0) {
                                    dimStack[dimStack.length-2].pop();
                                }
                                dimStack = dimStack.slice(0,((++pinDepth)*2));
                                let newSet = [{}];
                                if (!dimStack[dimStack.length-1][key]) dimStack[dimStack.length-1][key] = {};
                                dimStack[dimStack.length-1][key][value] = newSet;
                                dimStack.push(newSet)
                                dimStack.push(newSet[0]);
                            }
                            pinRecord = this.dimensions.reduce((r,dim,n)=>{
                                if (n <= col) r[dim.name] = record[dim.name];return r;
                            },{});
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
                        dimStack[dimStack.length-1][key] = record[key];
                    }
                    col++;
                }
                // for (let i=Object.keys(hotRecord).length;i<Object.keys(record).length;i++)  {
                //     let dim = this.dimensions[i];
                //     let key = Object.keys(record)[i]
                //     if (dim && dim.compressor === this._ASSIGN) {
                //         let slot = [{}];
                //         dimStack[dimStack.length - 1][key] = {[record[key]]:slot};
                //         dimStack.push(slot);
                //         dimStack.push(slot[0]);
                //         hotRecord = Object.keys(record).reduce((r,k,n)=>{
                //             if (n <= dimIndex) r[k] = record[k];
                //             return r;
                //         },{});
                //     } else {
                //         dimStack[dimStack.length-1][key] = record[key];
                //     }
                // }
                dimStack.pop();
                let slot = {};
                dimStack[dimStack.length-1].push(slot);
                dimStack.push(slot);
                index++;
            }
            return dimStack[0];
        }
        function sliceDimension(data,depth) {
            let baseValue = data[index];
            let result = [];
            while (index < data.length) {
                if (this.dimensions.slice(0,depth).some(dim=>data[index][dim.name] !== baseValue[dim.name])) break;
                result.push(Object.keys(data[index]).reduce((r, k, n) => {
                    if (n > 0) r[k] = data[index][k];
                    return r;
                }, {}));
                index++;
            }
            return result;
        }
        function slotDimension(data,depth) {
            let baseValue = data[index];
            let result = {};
            while (index < data.length) {
                if (this.dimensions.slice(0,depth).some(dim=>data[index][dim.name] !== baseValue[dim.name])) break;
                let key = Object.values(data[index])[depth];
                if (!result[key]) result[key] = [];
                result[key] = arrange.call(this,sliceDimension.call(this,),depth+1);
                i++;
            }
            return result;
        }
    }
    organize2(data) {
        if (this.dimensions.length === 0) return data;
        let index = 0;
        let dimensions = this.dimensions;
        data = data.sort((a,b)=>{
            for (let i=0;i<dimensions.length;i++) {
                if (a[dimensions[i].name]<b[dimensions[i].name]) return -1;
                else if (a[dimensions[i].name]>b[dimensions[i].name]) return 1;
            }
            return 0;
        })
        return process.call(this,{});

        function process(key) {
            let result = [];
            let resultRecord = {};
            let position = Object.keys(key).length;
            let pin = null;
            while(index < data.length) {
                let record = data[index];
                // if the current record doesn't match the key return to the caller
                for (let k of Object.keys(key)) {
                    if (record[k] !== key[k]) return result;
                }
                // step through remaining dimensions
                let compressorApplied = false;
                let i = position;
                while (i < dimensions.length) {
                    if (dimensions[i].compressor === this._ASSIGN) {
                        let result = process.call(this,getKey(record,i));
                        if (i<dimensions.length-1) resultRecord[record[[dimensions[i].name]]] = result;
                        else resultRecord[record[[dimensions[i].name]]] = result[0];
                        compressorApplied = true;
                        break;
                    } else if (dimensions[i].compressor === this._COMPRESS) {
                        pin = getKey(record,i-1);
                        let result = process.call(this,getKey(record,i));
                        for (let item of result) {
                            let base = record[dimensions[i].name];
                            if (i<dimensions.length-1) {
                                if (dimensions[i+1].compressor===this._COMPRESS) {
                                    for (let key in item) resultRecord[base+"."+key] = item[key];
                                } else {
                                    resultRecord[base+"."+item[dimensions[i+1].name]] = Object.keys(item).reduce((r,k)=>{
                                        if (k !== dimensions[i+1].name) r[k] = item[k];
                                        return r;
                                    },{});
                                }
                            } else Object.keys(item).reduce((r,k)=>{resultRecord[base+"."+k] = item[k]},{});
                        }
                        compressorApplied = true;
                        break;
                    } else if (dimensions[i].compressor !== this._SKIP) {
                        resultRecord[dimensions[i].name] = record[dimensions[i].name];
                    }
                    i++;
                }
                if (!compressorApplied) {
                    for (let attr in record) {
                        if (!dimensions.find(d=>d.name===attr)) resultRecord[attr] = record[attr];
                    }
                }
                result.push(Object.assign({},resultRecord));
                resultRecord = {};
                if (result.length > 1 && dimensions[i] && dimensions[i].compressor === this._COMPRESS) {
                    if (result[result.length-2][dimensions[i].name] === result[result.length-2][dimensions[i].name]) {
                        Object.assign(result[result.length-2][dimensions[i].name],result.pop());
                    }
                }

                let pinned = false;
                if (pin) pinned = !Object.keys(pin).some(k=>(pin[k]!==resultRecord[k]))
                if (!pinned) {
                    pin = null;
                }
                index++;
            }
            if (Object.keys(resultRecord).length > 0) result.push(resultRecord);
            return result;
        }
        function getKey(record,i) {
            return [...Array(i+1).keys()].reduce((r,ii)=>{
                r[dimensions[ii].name]=record[dimensions[ii].name];
                return r;
            },{});
        }
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
module.exports = DimPath;