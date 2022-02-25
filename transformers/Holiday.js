/**
 * Attempt to add a holiday attribute to the event, based on location and date.
 */
class Holiday {
    constructor(connector) {
        this.connector = connector;
        let Holidays = require('date-holidays');
        this.holiday = new Holidays();
        this.requires = ['country','state'];
        this.provides = ['holiday'];
    }
    async transform(context,event) {
        let location = {country:event.country,state:event.state};
        this.holiday.init(location.country);
        let result = this.holiday.isHoliday(event._time);
        if (result && result.name) Object.assign(event,{holiday:result.name});
    };
}
module.exports = Holiday;