let axios = require('axios');

class Weather {
    constructor(connector) {
        this.connector = connector;
        this.requires = ['location'];
        this.provides = ['weather','temperature','humidity','barometric_pressure','wind_speed',
            'wind_direction','wind_gust','weather_visibility'];
        this.key = this.connector.profile.secrets.OPENWEATHER_KEY;
        this.base = "https://api.openweathermap.org/data/2.5/weather"
    }
    async transform(context,event) {
        // let test = await axios.get('https://metric.im/pull/_event:view,site,source,country:KY/?_auth=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InNwcmFndWUiLCJ0cyI6MTY0NDg2NjUyNTUwNywiaWF0IjoxNjQ0ODY2NTI1LCJleHAiOjE2NzY0MDI1MjV9.t-FP592iTdGDMNyy9q_-JEpx7dIYy3IBNaXskrwF_6A');
        if (!event.latitude || !event.longitude) return;
        let result = await axios.get(`${this.base}?lon=${event.latitude}&lat=${event.longitude}&appid=${this.key}`);
        if (result && result.data.weather && result.data.weather.length>0) {
            event.weather = result.data.weather[0].description;
            event.temperature = result.data.main.temp;
            event.humidity = result.data.main.humidity;
            event.barometric_pressure = result.data.main.pressure;
            event.wind_speed = result.data.wind.speed;
            event.wind_direction = result.data.wind.deg;
            event.wind_gust = result.data.wind.gust;
            event.weather_visibility = result.data.visibility;
        }
    }
}
module.exports = Weather;