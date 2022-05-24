export default {
    name:"ratio",
    scope:"root",
    description: `Return the count ratio for the given value`,
    functions:{
        init:function() {
            return {count:0,sum:0}
        },
        accumulate:function(state,data) {
            return {
                count: state.count + 1,
                sum: state.sum + data
            }
        },
        merge:function(state1,state2) {
            return {
                count: state1.count + state2.count,
                sum: state1.sum + state2.sum
            }
        },
        finalize:function(state) {
            return Math.round((state.sum / state.count)*1000)/100;
        }
    }
}