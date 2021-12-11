/**
 * Formatter provides a number of utility functions for transforming data
 * into a style suitable for the requester.
 */
let moment = require('moment');

class Formatter {
    static csv(data,options={}) {
        let flat = Formatter.flatten(data,options);
        let header = "";
        for (let col in flat.template) header+="\""+col+"\",";
        let csv = header.slice(0,-1)+'\n';
        for (let col of flat.rows) {
            let row = "";
            for (let f of Object.keys(col)) row+=(typeof(col[f])==='string'?"\""+col[f]+"\"":col[f])+",";
            csv += row.slice(0,-1)+'\n';
        }
        return csv;
    };

    static flatten(data,options={}) {
        let template={};
        let rows = [];
        buildTemplate(data);
        rows.push(Object.assign({},template));
        read(data);
        return {template:template,rows:rows};

        function buildTemplate(data,name) {
            if (data === null) {
                template[name] = "null";
            } else if (Array.isArray(data)) {
                for (let i = 0; i < data.length; i++) {
                    buildTemplate(data[i],name);
                }
            } else if (typeof(data) === "object") {
                for (let o in data) {
                    if (data.hasOwnProperty(o)) buildTemplate(data[o],(name?name+"."+o:o));
                }
            } else {
                template[name] = typeof(data)==='string'?"":0;
            }
        }

        function read(data,name) {
            if (Array.isArray(data)) {
                let baserow = Object.assign({},rows[rows.length-1]);
                for (let i = 0; i < data.length; i++) {
                    if (i > 0) rows.push(Object.assign({},baserow));
                    read(data[i],name);
                }
            } else if (typeof(data) === "object" && data !== null) {
                if (data.constructor.name === "ObjectID") {
                    template[name] = data.toString();
                } else {
                    for (let o in data) {
                        if (data.hasOwnProperty(o)) read(data[o], (name ? name + "." + o : o));
                    }
                }
            } else {
                rows[rows.length-1][name] = data;
            }
        }
    };
}

module.exports = Formatter;