export default class Change {
    constructor(name) {
        this.name = name;
    }
    static description = 'Provides the change between the current value and the last value'
    static scope = 'root';
    $accumulator(params) {
        return {[this.name]:{$avg:'$'+this.name}};
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
