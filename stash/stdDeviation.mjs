export default {
    name:"stdDeviation",
    scope:"root",
    description: `Return the standard deviation of the metric`,
    functions:{
        init:function() {
            return {count:0,sum:0,points:[]}
        },
        accumulate:function(state,data) {
            state.points.push(data);
            return {
                count: state.count + 1,
                sum: state.sum + data,
                points:state.points
            }
        },
        merge:function(state1,state2) {
            return {
                count: state1.count + state2.count,
                sum: state1.sum + state2.sum,
                points: state1.points.concat(state2.points)
            }
        },
        finalize:function(state) {
            let mean = state.sum/state.count;
            let deviance = state.points.reduce((r,p)=>{
                r += (p-mean)**2;
                return r;
            },0);
            return Math.sqrt(deviance);
        }
    }
}