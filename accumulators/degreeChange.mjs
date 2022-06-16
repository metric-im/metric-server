export default class degreeChange {
    constructor() {
        this.inputs = Array.from(arguments)
        this.name = this.inputs.join('.');
    }
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
            },
            {
                $set:{[this.name]:{$switch:{branches:[
                    {case:{$gte:["$"+this.name,180]},then:{$subtract:[360,"$"+this.name]}},
                    {case:{$lte:["$"+this.name,-180]},then:{$add:[360,"$"+this.name]}}
                ],default:"$"+this.name}}}
            }
        ]
    }
}
