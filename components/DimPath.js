const Parser = require("./Parser");

class DimPath {
    constructor(fieldMap) {
        this.fieldMap = fieldMap;
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
            if (match[1]==='+') compressor=this._ASSIGN;
            else if (match[1]==='@') compressor=this._COMPRESS;
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
        if (!this.hasCompressors || this.dimensions.length === 0) return data;
        let index = 0;
        let dimensions = this.dimensions;
        return process([]);

        function process(key) {
            let result = [];
            while(index < data.length) {
                let record = data[index];
                let resultRecord = {};
                for (let kid of key) {
                    let keyname = Object.keys(kid)[0];
                    if (record[keyname] !== kid[keyname]) {
                        index--;
                        return result;
                    }
                }
                let compressorApplied = false;
                for (let i=key.length;i<dimensions.length;i++) {
                    if (dimensions[i].compressor && i > key.length) {
                        // process the remaining dimensions
                        resultRecord[dimensions[i].name] = process(dimensions.map(d=>{
                            return {[d.name]:record[d.name]}
                        }).slice(0,i)).reduce((r,d)=>{
                            // render array into object
                            r[d[dimensions[i].name]] = Object.keys(d).reduce((o,k)=>{
                                if (k !== dimensions[i].name) o[k] = d[k];
                                return o;
                            },{});
                            return r;
                        },{});
                        compressorApplied = true;
                    } else {
                        resultRecord[dimensions[i].name] = record[dimensions[i].name];
                    }
                }
                if (!compressorApplied) {
                    for (let attr in record) {
                        if (!dimensions.find(d=>d.name===attr)) resultRecord[attr] = record[attr];
                    }
                }
                index++;
                result.push(resultRecord);
            }
            return result;
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
        let type = this.fieldMap[name].type;
        if (['string','date','bool'].includes(type)) return val;
        else if (['int','long','double','decimal'].includes(type)) return Number(val);
        // else guess
        else return (/^[.0-9]*$/.test(val))?Number(val):val;
    }
}
module.exports = DimPath;