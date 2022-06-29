export default class Ratio {
    constructor() {
        this.name = name;
    }
    static scope = 'root';
    $accumulator(params) {
        return {[this.name]:{$avg:this.name}};
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
