class Configuration {
    static get masterProfileFields() {
        return [
            {name:"_id",accountId:"_master",description:"",dimension:false,metric:false,system:true},
            {name:"_created",accountId:"_master",description:"",dimension:false,metric:false,system:true},
            {name:"_createdBy",accountId:"_master",description:"",dimension:false,metric:false,system:true},
            {name:"_type",accountId:"_master",description:"Event type",dimension:false,metric:false,system:true},
            {name:"accountId",accountId:"_master",description:"",dimension:false,metric:false,system:true},
            {name:"hour",accountId:"_master",description:"Hour of the day on which this event occurred",dimension:true,metric:true},
            {name:"day",accountId:"_master",description:"Day of the month on which this event occurred",dimension:true,metric:true},
            {name:"week",accountId:"_master",description:"Week of the year on which this event occurred",dimension:true,metric:true},
            {name:"month",accountId:"_master",description:"Month of the year on which this event occurred",dimension:true,metric:true},
            {name:"year",accountId:"_master",description:"Year during which this event occurred",dimension:true,metric:true},
            {name:"date",accountId:"_master",description:"ISO Date of this event, YYYY-MM-DD",dimension:true,metric:true},
            {name:"deviceId",accountId:"_master",description:"Unique Device Identifier",dimension:true,metric:true},
            {name:"timestamp",accountId:"_master",description:"Event reported time",dimension:true,metric:true}
        ]
    }
}
module.exports = Configuration;