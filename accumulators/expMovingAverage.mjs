export default class ExpMovingAverage {
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
                        [this.name]:{
                            $expMovingAvg: { input: "$"+this.name, alpha: 0.10 }
                        }
                    }
                }
            }
        ]
    }
}
