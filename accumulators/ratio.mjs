export default class Ratio {
    constructor() {
        this.inputs = Array.from(arguments)
        this.name = this.inputs.join('.');
    }
    static scope = 'root';
    $accumulator(params) {
        return {[this.name]:{$avg:{$add:[this.inputs.map(arg=>'$'+arg).join(',')]}}};
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
