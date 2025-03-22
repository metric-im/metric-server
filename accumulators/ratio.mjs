export default class Ratio {
    constructor(name) {
        this.name = name;
    }
    static description = `The ratio of this metric calculated across the given dimensions`
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
                        [this.name+'_total']:{
                            $sum:"$"+this.name,
                            window:{documents:["unbounded","unbounded"]}
                        }
                    }
                }
            },
            {
                $addFields:{[this.name]:{$round:[{$multiply:[{$divide:['$'+this.name,'$'+this.name+'_total']},100]},2]}}
            },
            {
                $project:{[this.name+"_total"]:0}
            }
        ]
    }
}
