let axios = require('axios');

class Weather {
    constructor(connector) {
        this.connector = connector;
        this.requires = ['location'];
        this.provides = ['weather','temperature','humidity','barometer','wind_speed',
            'wind_direction','wind_gust','weather_visibility'];
        this.key = this.connector.profile.secrets.OPENWEATHER_KEY;
        this.base = "https://api.openweathermap.org/data/2.5/weather"
    }
    async transform(context,event) {
        if (!event.latitude || !event.longitude) return;
        let url = `${this.base}?lon=${event.latitude}&lat=${event.longitude}&appid=${this.key}&units=metric`;
        let result = await axios.get(url);
        if (result && result.data.weather && result.data.weather.length>0) {
            event.weather = result.data.weather[0].main;
            event.weatherDescription = result.data.weather[0].description;
            event.temperature = result.data.main.temp;
            event.humidity = result.data.main.humidity;
            event.barometer = result.data.main.pressure;
            event.wind_speed = result.data.wind.speed;
            event.wind_direction = result.data.wind.deg;
            event.wind_gust = result.data.wind.gust;
            event.weather_visibility = result.data.visibility;
        }
    }
}
module.exports = Weather;