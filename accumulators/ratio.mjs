export default class Ratio {
    constructor() {
        this.args = Array.from(arguments);
        this.name = this.args.join('.');
    }
    static scope = 'root';
    $accumulator() {
        return {[this.name]:{$avg:{$add:[this.args.map(arg=>'$'+arg).join(',')]}}};
    }
    $setWindowFields() {
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
