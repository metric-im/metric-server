export default class Formatter {
    constructor(dp,props) {
        this.dp = dp;
        if (props) this.options = props.reduce((r,p)=>{r[p]=true;return r},{});
        else this.options = {};
    }
    async render(res,data) {
        if (this.options.file) this.sendFile(res,data,'data.json');
        else res.send(data);
    }
    sendFile(res,data,name='data.txt') {
        res.setHeader('Content-type', "application/octet-stream");
        res.setHeader('Content-disposition', 'attachment; filename='+name);
        res.charset = 'UTF-8';
        res.send(data);
        res.end();
    }

    /**
     * Build a grid from the incoming data, transposing object and array results
     * into name value pairs
     *
     * @param data
     * @returns {{template: {}, rows: *[]}}
     */
    flatten(data) {
        let template={};
        let rows = [];
        buildTemplate(data);
        rows.push(Object.assign({},template));
        read(data);
        return {template:Object.keys(template),rows:rows};

        function buildTemplate(data,name) {
            if (data === null) {
                template[name] = "null";
            } else if (Array.isArray(data)) {
                for (let i = 0; i < data.length; i++) {
                    buildTemplate(data[i],name);
                }
            } else if (typeof(data) === "object") {
                if (data.constructor.name === "ObjectID") {
                    template[name] = data.toString();
                } else {
                    for (let o in data) {
                        if (data.hasOwnProperty(o)) buildTemplate(data[o],(name?name+"."+o:o));
                    }
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
    }
    template(dimensions,metrics) {
        return {
            dimensions:(Array.isArray(dimensions)?dimensions:[dimensions]),
            metrics:(Array.isArray(metrics)?metrics:[metrics]),
        }
    }
}
