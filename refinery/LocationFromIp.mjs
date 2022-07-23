/**
 * The IP address in the request object expands the event data with location data
 * This is not precise and can be easily spoofed. For informational purposes it
 * can provide interesting data with no PII.
 */
import geoIp from 'geoip-lite';
export default class LocationFromIp {
    constructor(connector) {
        this.connector = connector;
        this.requires=[];
        this.provides = [
            {_id:'location',dataType:"string",accumulator:"addToSet"},
            {_id:'country',dataType:"string",accumulator:"addToSet"},
            {_id:'region',dataType:"string",accumulator:"addToSet"},
            {_id:'timezone',dataType:"string",accumulator:"addToSet"},
            {_id:'city',dataType:"string",accumulator:"addToSet"},
            {_id:'latitude',dataType:"float",accumulator:"avg"},
            {_id:'longitude',dataType:"float",accumulator:"avg"}
        ]
    }
    async process(context,event) {
        if (!context.ip) return;
        let ip = context.ip.replace(/::ffff:/,"");
        if (ip === "::1") ip = "208.157.149.67"; // TESTING
        let geo = geoIp.lookup(ip);
        if (geo) {
            Object.assign(event,{
                country: geo.country,
                region: geo.region,
                timezone: geo.timezone,
                city: geo.city,
                latitude: geo.ll[0],
                longitude: geo.ll[1]
            });
        }
    };
}
