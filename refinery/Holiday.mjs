/**
 * Attempt to add a holiday attribute to the event, based on location and date.
 */
import Holidays from 'date-holidays';
export default class Holiday {
    constructor(connector) {
        this.connector = connector;
        this.holiday = new Holidays();
        this.requires = ['country','state'];
        this.provides = [
            {_id:'holiday',dataType:"string",accumulator:"addToSet"},
        ];
    }
    async process(context,event) {
        let location = {country:event.country,state:event.state};
        this.holiday.init(location.country);
        let result = this.holiday.isHoliday(event._time);
        if (result && result.name) Object.assign(event,{holiday:result.name});
    };
}
