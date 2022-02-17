/**
 * The IP address in the request object expands the event data with location data
 * This is not precise and can be easily spoofed. For informational purposes it
 * can provide interesting data with no PII.
 */
class LocationFromIP {
    constructor(connector) {
        this.connector = connector;
        this.geoip = require('geoip-lite');
    }
    async transform(req,event) {
        let ip = req.ip.replace(/::ffff:/,"");
        if (ip === "::1") ip = '208.157.149.67'; //TODO: remove from PROD
        let geo = this.geoip.lookup(ip);
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
module.exports = LocationFromIP;