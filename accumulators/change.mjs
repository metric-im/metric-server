export default class Change {
    constructor() {
        this.inputs = Array.from(arguments)
        this.name = this.inputs.join('.');
    }
    static descrtiption = 'provides the change be the current value and the last value'
    static scope = 'root';
    $accumulator(params) {
        return {[this.name]:{$avg:{$add:this.inputs.map(arg=>'$'+arg)}}};
    }
    $setWindowFields(params) {
        return [
            {
                $setWindowFields:{
                    sortBy:{_id:1},
                    output:{
                        [this.name]:{
                            $push:"$"+this.name,
                            window:{documents:[-1,"current"]}
                        }
                    }
                }
            },
            {
                $match: { $expr: { $eq: [{ $size: "$"+this.name }, 2] } },
            },
            {
                $set:{[this.name]:{$subtract: [{ $last: "$"+this.name }, { $first: "$"+this.name }]}}
            }
        ]
    }
}
