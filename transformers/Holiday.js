/**
 * Attempt to add a holiday attribute to the event, based on location and date.
 */
class Holiday {
    constructor(connector) {
        this.connector = connector;
        let Holidays = require('date-holidays');
        this.holiday = new Holidays();
    }
    async transform(req,event) {
        let location = {country:event.country,state:event.state};
        if (!event.country || !event.state) {
            location = new (require('./LocationFromIP'))(this.connector);
            await location.transform(req,event);
            location = {country:event.country,state:event.state};
        }
        this.holiday.init(location.country);
        event._time=new Date('2022-12-25');
        let result = this.holiday.isHoliday(event._time);
        if (result && result.name) Object.assign(event,{holiday:result.name});
    };
}
module.exports = Holiday;