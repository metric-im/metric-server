export default class ExpMovingAverage {
    constructor() {
        this.inputs = Array.from(arguments)
        this.name = this.inputs.join('.');
    }
    static description = `Moving average for the input metric. Look back ten records or provided number, i.e. :expMovingAverage.15`
    static scope = 'root';
    $accumulator(params) {
        return {[this.name]:{$avg:{$add:[this.inputs.map(arg=>'$'+arg).join(',')]}}};
    }
    $setWindowFields(records) {
        records = records?parseInt(records):10;
        return [
            {
                $setWindowFields:{
                    sortBy:{_id:1},
                    output:{
                        [this.name]:{
                            $expMovingAvg: { input: "$"+this.name, N: records }
                        }
                    }
                }
            }
        ]
    }
}
