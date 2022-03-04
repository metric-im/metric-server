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
            while(index < data.length) {
                let record = data[index];
                // if the current record doesn't match the key return to the caller
                for (let k of Object.keys(key)) {
                    if (record[k] !== key[k]) return result;
                }
                // step through remaining dimensions
                let compressorApplied = false;
                let position = Object.keys(key).length;
                let i = position;
                while (i < dimensions.length) {
                    if (dimensions[i].compressor === this._ASSIGN) {
                        let result = process.call(this,getKey(record,i));
                        if (i<dimensions.length-1) resultRecord[record[[dimensions[i].name]]] = result;
                        else resultRecord[record[[dimensions[i].name]]] = result[0];
                        compressorApplied = true;
                        break;
                    } else if (dimensions[i].compressor === this._COMPRESS) {
                        let result = process.call(this,getKey(record,i));
                        for (let item of result) {
                            let base = record[dimensions[i].name];
                            if (i<dimensions.length-1) {
                                resultRecord[base+"."+item[dimensions[i+1].name]] = Object.keys(item).reduce((r,k)=>{
                                    if (k !== dimensions[i+1].name) r[k] = item[k];
                                    return r;
                                },{});
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
                index++;
            }
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