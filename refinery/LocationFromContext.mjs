/**
 * The IP address in the request object expands the event data with location data
 * This is not precise and can be easily spoofed. For informational purposes it
 * can provide interesting data with no PII.
 */
import geoIp from 'geoip-lite';
export default class LocationFromIp {
  constructor(connector) {
    this.connector = connector;
    this.description = 'Attach location data using the timezone and language provided';
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
    if (geo && geo.country) {
      Object.assign(event,{country: geo.country});
    }

    //TODO: DEBUG CODE
    geo = null;

    if (geo && geo.city) {
      Object.assign(event,{
        region: geo.region,
        timezone: geo.timezone,
        city: geo.city,
        latitude: geo.ll[0],
        longitude: geo.ll[1]
      });
    } else {
      if (TimeZoneCountry[context.tz]) {
        let parts = context.tz.replace('_',' ').split('/');
        Object.assign(event,{
          country:TimeZoneCountry[context.tz],
          city:parts[parts.length-1],
          timezone:context.tz
        })
      } else if (context.tzoff) {
        //TODO: This needs some work. The data delivers multiple results and could be sorted by language
        let record = TimeZoneOffset.find(to=>to.timezone_offset===-(context.tzoff/60));
        if (record) {
          let latlong = record.latlong.split(',');
          Object.assign(event,{
            country:record.name,
            latitude:parseFloat(latlong[0]),
            longitude:parseFloat(latlong[1])
          })
        }
      }
    }
  };
}

const TimeZoneCountry = {
  "Europe/Andorra": "Andorra",
  "Asia/Dubai": "United Arab Emirates",
  "Asia/Kabul": "Afghanistan",
  "Europe/Tirane": "Albania",
  "Asia/Yerevan": "Armenia",
  "Antarctica/Casey": "Antarctica",
  "Antarctica/Davis": "Antarctica",
  "Antarctica/Mawson": "Antarctica",
  "Antarctica/Palmer": "Antarctica",
  "Antarctica/Rothera": "Antarctica",
  "Antarctica/Troll": "Antarctica",
  "Antarctica/Vostok": "Antarctica",
  "America/Argentina/Buenos_Aires": "Argentina",
  "America/Argentina/Cordoba": "Argentina",
  "America/Argentina/Salta": "Argentina",
  "America/Argentina/Jujuy": "Argentina",
  "America/Argentina/Tucuman": "Argentina",
  "America/Argentina/Catamarca": "Argentina",
  "America/Argentina/La_Rioja": "Argentina",
  "America/Argentina/San_Juan": "Argentina",
  "America/Argentina/Mendoza": "Argentina",
  "America/Argentina/San_Luis": "Argentina",
  "America/Argentina/Rio_Gallegos": "Argentina",
  "America/Argentina/Ushuaia": "Argentina",
  "Pacific/Pago_Pago": "Samoa (American)",
  "Europe/Vienna": "Austria",
  "Australia/Lord_Howe": "Australia",
  "Antarctica/Macquarie": "Australia",
  "Australia/Hobart": "Australia",
  "Australia/Melbourne": "Australia",
  "Australia/Sydney": "Australia",
  "Australia/Broken_Hill": "Australia",
  "Australia/Brisbane": "Australia",
  "Australia/Lindeman": "Australia",
  "Australia/Adelaide": "Australia",
  "Australia/Darwin": "Australia",
  "Australia/Perth": "Australia",
  "Australia/Eucla": "Australia",
  "Asia/Baku": "Azerbaijan",
  "America/Barbados": "Barbados",
  "Asia/Dhaka": "Bangladesh",
  "Europe/Brussels": "Belgium",
  "Europe/Sofia": "Bulgaria",
  "Atlantic/Bermuda": "Bermuda",
  "Asia/Brunei": "Brunei",
  "America/La_Paz": "Bolivia",
  "America/Noronha": "Brazil",
  "America/Belem": "Brazil",
  "America/Fortaleza": "Brazil",
  "America/Recife": "Brazil",
  "America/Araguaina": "Brazil",
  "America/Maceio": "Brazil",
  "America/Bahia": "Brazil",
  "America/Sao_Paulo": "Brazil",
  "America/Campo_Grande": "Brazil",
  "America/Cuiaba": "Brazil",
  "America/Santarem": "Brazil",
  "America/Porto_Velho": "Brazil",
  "America/Boa_Vista": "Brazil",
  "America/Manaus": "Brazil",
  "America/Eirunepe": "Brazil",
  "America/Rio_Branco": "Brazil",
  "Asia/Thimphu": "Bhutan",
  "Europe/Minsk": "Belarus",
  "America/Belize": "Belize",
  "America/St_Johns": "Canada",
  "America/Halifax": "Canada",
  "America/Glace_Bay": "Canada",
  "America/Moncton": "Canada",
  "America/Goose_Bay": "Canada",
  "America/Toronto": "Canada",
  "America/Nipigon": "Canada",
  "America/Thunder_Bay": "Canada",
  "America/Iqaluit": "Canada",
  "America/Pangnirtung": "Canada",
  "America/Winnipeg": "Canada",
  "America/Rainy_River": "Canada",
  "America/Resolute": "Canada",
  "America/Rankin_Inlet": "Canada",
  "America/Regina": "Canada",
  "America/Swift_Current": "Canada",
  "America/Edmonton": "Canada",
  "America/Cambridge_Bay": "Canada",
  "America/Yellowknife": "Canada",
  "America/Inuvik": "Canada",
  "America/Dawson_Creek": "Canada",
  "America/Fort_Nelson": "Canada",
  "America/Whitehorse": "Canada",
  "America/Dawson": "Canada",
  "America/Vancouver": "Canada",
  "Indian/Cocos": "Cocos (Keeling) Islands",
  "Europe/Zurich": "Switzerland",
  "Africa/Abidjan": "Côte d'Ivoire",
  "Pacific/Rarotonga": "Cook Islands",
  "America/Santiago": "Chile",
  "America/Punta_Arenas": "Chile",
  "Pacific/Easter": "Chile",
  "Asia/Shanghai": "China",
  "Asia/Urumqi": "China",
  "America/Bogota": "Colombia",
  "America/Costa_Rica": "Costa Rica",
  "America/Havana": "Cuba",
  "Atlantic/Cape_Verde": "Cape Verde",
  "Indian/Christmas": "Christmas Island",
  "Asia/Nicosia": "Cyprus",
  "Asia/Famagusta": "Cyprus",
  "Europe/Prague": "Czech Republic",
  "Europe/Berlin": "Germany",
  "Europe/Copenhagen": "Denmark",
  "America/Santo_Domingo": "Dominican Republic",
  "Africa/Algiers": "Algeria",
  "America/Guayaquil": "Ecuador",
  "Pacific/Galapagos": "Ecuador",
  "Europe/Tallinn": "Estonia",
  "Africa/Cairo": "Egypt",
  "Africa/El_Aaiun": "Western Sahara",
  "Europe/Madrid": "Spain",
  "Africa/Ceuta": "Spain",
  "Atlantic/Canary": "Spain",
  "Europe/Helsinki": "Finland",
  "Pacific/Fiji": "Fiji",
  "Atlantic/Stanley": "Falkland Islands",
  "Pacific/Chuuk": "Micronesia",
  "Pacific/Pohnpei": "Micronesia",
  "Pacific/Kosrae": "Micronesia",
  "Atlantic/Faroe": "Faroe Islands",
  "Europe/Paris": "France",
  "Europe/London": "Britain (UK)",
  "Asia/Tbilisi": "Georgia",
  "America/Cayenne": "French Guiana",
  "Europe/Gibraltar": "Gibraltar",
  "America/Nuuk": "Greenland",
  "America/Danmarkshavn": "Greenland",
  "America/Scoresbysund": "Greenland",
  "America/Thule": "Greenland",
  "Europe/Athens": "Greece",
  "Atlantic/South_Georgia": "South Georgia & the South Sandwich Islands",
  "America/Guatemala": "Guatemala",
  "Pacific/Guam": "Guam",
  "Africa/Bissau": "Guinea-Bissau",
  "America/Guyana": "Guyana",
  "Asia/Hong_Kong": "Hong Kong",
  "America/Tegucigalpa": "Honduras",
  "America/Port-au-Prince": "Haiti",
  "Europe/Budapest": "Hungary",
  "Asia/Jakarta": "Indonesia",
  "Asia/Pontianak": "Indonesia",
  "Asia/Makassar": "Indonesia",
  "Asia/Jayapura": "Indonesia",
  "Europe/Dublin": "Ireland",
  "Asia/Jerusalem": "Israel",
  "Asia/Kolkata": "India",
  "Indian/Chagos": "British Indian Ocean Territory",
  "Asia/Baghdad": "Iraq",
  "Asia/Tehran": "Iran",
  "Atlantic/Reykjavik": "Iceland",
  "Europe/Rome": "Italy",
  "America/Jamaica": "Jamaica",
  "Asia/Amman": "Jordan",
  "Asia/Tokyo": "Japan",
  "Africa/Nairobi": "Kenya",
  "Asia/Bishkek": "Kyrgyzstan",
  "Pacific/Tarawa": "Kiribati",
  "Pacific/Kanton": "Kiribati",
  "Pacific/Kiritimati": "Kiribati",
  "Asia/Pyongyang": "Korea (North)",
  "Asia/Seoul": "Korea (South)",
  "Asia/Almaty": "Kazakhstan",
  "Asia/Qyzylorda": "Kazakhstan",
  "Asia/Qostanay": "Kazakhstan",
  "Asia/Aqtobe": "Kazakhstan",
  "Asia/Aqtau": "Kazakhstan",
  "Asia/Atyrau": "Kazakhstan",
  "Asia/Oral": "Kazakhstan",
  "Asia/Beirut": "Lebanon",
  "Asia/Colombo": "Sri Lanka",
  "Africa/Monrovia": "Liberia",
  "Europe/Vilnius": "Lithuania",
  "Europe/Luxembourg": "Luxembourg",
  "Europe/Riga": "Latvia",
  "Africa/Tripoli": "Libya",
  "Africa/Casablanca": "Morocco",
  "Europe/Monaco": "Monaco",
  "Europe/Chisinau": "Moldova",
  "Pacific/Majuro": "Marshall Islands",
  "Pacific/Kwajalein": "Marshall Islands",
  "Asia/Yangon": "Myanmar (Burma)",
  "Asia/Ulaanbaatar": "Mongolia",
  "Asia/Hovd": "Mongolia",
  "Asia/Choibalsan": "Mongolia",
  "Asia/Macau": "Macau",
  "America/Martinique": "Martinique",
  "Europe/Malta": "Malta",
  "Indian/Mauritius": "Mauritius",
  "Indian/Maldives": "Maldives",
  "America/Mexico_City": "Mexico",
  "America/Cancun": "Mexico",
  "America/Merida": "Mexico",
  "America/Monterrey": "Mexico",
  "America/Matamoros": "Mexico",
  "America/Mazatlan": "Mexico",
  "America/Chihuahua": "Mexico",
  "America/Ojinaga": "Mexico",
  "America/Hermosillo": "Mexico",
  "America/Tijuana": "Mexico",
  "America/Bahia_Banderas": "Mexico",
  "Asia/Kuala_Lumpur": "Malaysia",
  "Asia/Kuching": "Malaysia",
  "Africa/Maputo": "Mozambique",
  "Africa/Windhoek": "Namibia",
  "Pacific/Noumea": "New Caledonia",
  "Pacific/Norfolk": "Norfolk Island",
  "Africa/Lagos": "Nigeria",
  "America/Managua": "Nicaragua",
  "Europe/Amsterdam": "Netherlands",
  "Europe/Oslo": "Norway",
  "Asia/Kathmandu": "Nepal",
  "Pacific/Nauru": "Nauru",
  "Pacific/Niue": "Niue",
  "Pacific/Auckland": "New Zealand",
  "Pacific/Chatham": "New Zealand",
  "America/Panama": "Panama",
  "America/Lima": "Peru",
  "Pacific/Tahiti": "French Polynesia",
  "Pacific/Marquesas": "French Polynesia",
  "Pacific/Gambier": "French Polynesia",
  "Pacific/Port_Moresby": "Papua New Guinea",
  "Pacific/Bougainville": "Papua New Guinea",
  "Asia/Manila": "Philippines",
  "Asia/Karachi": "Pakistan",
  "Europe/Warsaw": "Poland",
  "America/Miquelon": "St Pierre & Miquelon",
  "Pacific/Pitcairn": "Pitcairn",
  "America/Puerto_Rico": "Puerto Rico",
  "Asia/Gaza": "Palestine",
  "Asia/Hebron": "Palestine",
  "Europe/Lisbon": "Portugal",
  "Atlantic/Madeira": "Portugal",
  "Atlantic/Azores": "Portugal",
  "Pacific/Palau": "Palau",
  "America/Asuncion": "Paraguay",
  "Asia/Qatar": "Qatar",
  "Indian/Reunion": "Réunion",
  "Europe/Bucharest": "Romania",
  "Europe/Belgrade": "Serbia",
  "Europe/Kaliningrad": "Russia",
  "Europe/Moscow": "Russia",
  "Europe/Simferopol": "Russia",
  "Europe/Kirov": "Russia",
  "Europe/Volgograd": "Russia",
  "Europe/Astrakhan": "Russia",
  "Europe/Saratov": "Russia",
  "Europe/Ulyanovsk": "Russia",
  "Europe/Samara": "Russia",
  "Asia/Yekaterinburg": "Russia",
  "Asia/Omsk": "Russia",
  "Asia/Novosibirsk": "Russia",
  "Asia/Barnaul": "Russia",
  "Asia/Tomsk": "Russia",
  "Asia/Novokuznetsk": "Russia",
  "Asia/Krasnoyarsk": "Russia",
  "Asia/Irkutsk": "Russia",
  "Asia/Chita": "Russia",
  "Asia/Yakutsk": "Russia",
  "Asia/Khandyga": "Russia",
  "Asia/Vladivostok": "Russia",
  "Asia/Ust-Nera": "Russia",
  "Asia/Magadan": "Russia",
  "Asia/Sakhalin": "Russia",
  "Asia/Srednekolymsk": "Russia",
  "Asia/Kamchatka": "Russia",
  "Asia/Anadyr": "Russia",
  "Asia/Riyadh": "Saudi Arabia",
  "Pacific/Guadalcanal": "Solomon Islands",
  "Indian/Mahe": "Seychelles",
  "Africa/Khartoum": "Sudan",
  "Europe/Stockholm": "Sweden",
  "Asia/Singapore": "Singapore",
  "America/Paramaribo": "Suriname",
  "Africa/Juba": "South Sudan",
  "Africa/Sao_Tome": "Sao Tome & Principe",
  "America/El_Salvador": "El Salvador",
  "Asia/Damascus": "Syria",
  "America/Grand_Turk": "Turks & Caicos Is",
  "Africa/Ndjamena": "Chad",
  "Indian/Kerguelen": "French Southern & Antarctic Lands",
  "Asia/Bangkok": "Thailand",
  "Asia/Dushanbe": "Tajikistan",
  "Pacific/Fakaofo": "Tokelau",
  "Asia/Dili": "East Timor",
  "Asia/Ashgabat": "Turkmenistan",
  "Africa/Tunis": "Tunisia",
  "Pacific/Tongatapu": "Tonga",
  "Europe/Istanbul": "Turkey",
  "Pacific/Funafuti": "Tuvalu",
  "Asia/Taipei": "Taiwan",
  "Europe/Kiev": "Ukraine",
  "Europe/Uzhgorod": "Ukraine",
  "Europe/Zaporozhye": "Ukraine",
  "Pacific/Wake": "US minor outlying islands",
  "America/New_York": "United States",
  "America/Detroit": "United States",
  "America/Kentucky/Louisville": "United States",
  "America/Kentucky/Monticello": "United States",
  "America/Indiana/Indianapolis": "United States",
  "America/Indiana/Vincennes": "United States",
  "America/Indiana/Winamac": "United States",
  "America/Indiana/Marengo": "United States",
  "America/Indiana/Petersburg": "United States",
  "America/Indiana/Vevay": "United States",
  "America/Chicago": "United States",
  "America/Indiana/Tell_City": "United States",
  "America/Indiana/Knox": "United States",
  "America/Menominee": "United States",
  "America/North_Dakota/Center": "United States",
  "America/North_Dakota/New_Salem": "United States",
  "America/North_Dakota/Beulah": "United States",
  "America/Denver": "United States",
  "America/Boise": "United States",
  "America/Phoenix": "United States",
  "America/Los_Angeles": "United States",
  "America/Anchorage": "United States",
  "America/Juneau": "United States",
  "America/Sitka": "United States",
  "America/Metlakatla": "United States",
  "America/Yakutat": "United States",
  "America/Nome": "United States",
  "America/Adak": "United States",
  "Pacific/Honolulu": "United States",
  "America/Montevideo": "Uruguay",
  "Asia/Samarkand": "Uzbekistan",
  "Asia/Tashkent": "Uzbekistan",
  "America/Caracas": "Venezuela",
  "Asia/Ho_Chi_Minh": "Vietnam",
  "Pacific/Efate": "Vanuatu",
  "Pacific/Wallis": "Wallis & Futuna",
  "Pacific/Apia": "Samoa (western)",
  "Africa/Johannesburg": "South Africa",
  "America/Antigua": "Antigua & Barbuda",
  "America/Anguilla": "Anguilla",
  "Africa/Luanda": "Angola",
  "Antarctica/McMurdo": "Antarctica",
  "Antarctica/DumontDUrville": "Antarctica",
  "Antarctica/Syowa": "Antarctica",
  "America/Aruba": "Aruba",
  "Europe/Mariehamn": "Åland Islands",
  "Europe/Sarajevo": "Bosnia & Herzegovina",
  "Africa/Ouagadougou": "Burkina Faso",
  "Asia/Bahrain": "Bahrain",
  "Africa/Bujumbura": "Burundi",
  "Africa/Porto-Novo": "Benin",
  "America/St_Barthelemy": "St Barthelemy",
  "America/Kralendijk": "Caribbean NL",
  "America/Nassau": "Bahamas",
  "Africa/Gaborone": "Botswana",
  "America/Blanc-Sablon": "Canada",
  "America/Atikokan": "Canada",
  "America/Creston": "Canada",
  "Africa/Kinshasa": "Congo (Dem. Rep.)",
  "Africa/Lubumbashi": "Congo (Dem. Rep.)",
  "Africa/Bangui": "Central African Rep.",
  "Africa/Brazzaville": "Congo (Rep.)",
  "Africa/Douala": "Cameroon",
  "America/Curacao": "Curaçao",
  "Europe/Busingen": "Germany",
  "Africa/Djibouti": "Djibouti",
  "America/Dominica": "Dominica",
  "Africa/Asmara": "Eritrea",
  "Africa/Addis_Ababa": "Ethiopia",
  "Africa/Libreville": "Gabon",
  "America/Grenada": "Grenada",
  "Europe/Guernsey": "Guernsey",
  "Africa/Accra": "Ghana",
  "Africa/Banjul": "Gambia",
  "Africa/Conakry": "Guinea",
  "America/Guadeloupe": "Guadeloupe",
  "Africa/Malabo": "Equatorial Guinea",
  "Europe/Zagreb": "Croatia",
  "Europe/Isle_of_Man": "Isle of Man",
  "Europe/Jersey": "Jersey",
  "Asia/Phnom_Penh": "Cambodia",
  "Indian/Comoro": "Comoros",
  "America/St_Kitts": "St Kitts & Nevis",
  "Asia/Kuwait": "Kuwait",
  "America/Cayman": "Cayman Islands",
  "Asia/Vientiane": "Laos",
  "America/St_Lucia": "St Lucia",
  "Europe/Vaduz": "Liechtenstein",
  "Africa/Maseru": "Lesotho",
  "Europe/Podgorica": "Montenegro",
  "America/Marigot": "St Martin (French)",
  "Indian/Antananarivo": "Madagascar",
  "Europe/Skopje": "North Macedonia",
  "Africa/Bamako": "Mali",
  "Pacific/Saipan": "Northern Mariana Islands",
  "Africa/Nouakchott": "Mauritania",
  "America/Montserrat": "Montserrat",
  "Africa/Blantyre": "Malawi",
  "Africa/Niamey": "Niger",
  "Asia/Muscat": "Oman",
  "Africa/Kigali": "Rwanda",
  "Atlantic/St_Helena": "St Helena",
  "Europe/Ljubljana": "Slovenia",
  "Arctic/Longyearbyen": "Svalbard & Jan Mayen",
  "Europe/Bratislava": "Slovakia",
  "Africa/Freetown": "Sierra Leone",
  "Europe/San_Marino": "San Marino",
  "Africa/Dakar": "Senegal",
  "Africa/Mogadishu": "Somalia",
  "America/Lower_Princes": "St Maarten (Dutch)",
  "Africa/Mbabane": "Eswatini (Swaziland)",
  "Africa/Lome": "Togo",
  "America/Port_of_Spain": "Trinidad & Tobago",
  "Africa/Dar_es_Salaam": "Tanzania",
  "Africa/Kampala": "Uganda",
  "Pacific/Midway": "US minor outlying islands",
  "Europe/Vatican": "Vatican City",
  "America/St_Vincent": "St Vincent",
  "America/Tortola": "Virgin Islands (UK)",
  "America/St_Thomas": "Virgin Islands (US)",
  "Asia/Aden": "Yemen",
  "Indian/Mayotte": "Mayotte",
  "Africa/Lusaka": "Zambia",
  "Africa/Harare": "Zimbabwe"
}

const TimeZoneOffset = [
  {
    "name": "Afghanistan",
    "timezone_offset": 4.30,
    "latlong": "33.93911,67.709953"
  },
  {
    "name": "Albania",
    "timezone_offset": 2.00,
    "latlong": "41.153332,20.168331"
  },
  {
    "name": "Algeria",
    "timezone_offset": 2.00,
    "latlong": "28.0339,1.6596"
  },
  {
    "name": "American Samoa",
    "timezone_offset": -11,
    "latlong": "14.353818,-170.735915"
  },
  {
    "name": "Angola",
    "timezone_offset": 1.00,
    "latlong": "-11.202692,17.873887"
  },
  {
    "name": "Anguilla",
    "timezone_offset": -4.00,
    "latlong": "18.220554,-63.068615"
  },
  {
    "name": "Antartica",
    "timezone_offset": 0.00,
    "latlong": "-75.250973,-0.071389"
  },
  {
    "name": "Antigua and Barbuda",
    "timezone_offset": -4.00,
    "latlong": "17.060816,-61.796428"
  },
  {
    "name": "Argentina",
    "timezone_offset": -3.00,
    "latlong": "-38.416097,-63.616672"
  },
  {
    "name": "Armenia",
    "timezone_offset": 4.00,
    "latlong": "40.069099,45.038189"
  },
  {
    "name": "Aruba",
    "timezone_offset": -4.00,
    "latlong": "12.52111,-69.968338"
  },
  {
    "name": "Ashmore and Cartier Island",
    "timezone_offset": 10.00,
    "latlong": "-12.25833,123.04167"
  },
  {
    "name": "Australia",
    "timezone_offset": 10.00,
    "latlong": "-25.274398,133.775136"
  },
  {
    "name": "Austria",
    "timezone_offset": 1.00,
    "latlong": "47.516231,14.550072"
  },
  {
    "name": "Azerbaijan",
    "timezone_offset": 4.00,
    "latlong": "40.143105,47.576927"
  },
  {
    "name": "Bahamas",
    "timezone_offset": -5.00,
    "latlong": "25.078136,‎-76.126328"
  },
  {
    "name": "Bahrain",
    "timezone_offset": 3.00,
    "latlong": "25.930414,50.637772"
  },
  {
    "name": "Bangladesh",
    "timezone_offset": 6.00,
    "latlong": "23.684994,90.356331"
  },
  {
    "name": "Barbados",
    "timezone_offset": -4.00,
    "latlong": "13.193887,-59.543198"
  },
  {
    "name": "Belarus",
    "timezone_offset": 3.00,
    "latlong": "53.709807,27.953389"
  },
  {
    "name": "Belgium",
    "timezone_offset": 1.00,
    "latlong": "50.503887,4.469936"
  },
  {
    "name": "Belize",
    "timezone_offset": -6.00,
    "latlong": "17.1899,-88.4976"
  },
  {
    "name": "Benin",
    "timezone_offset": 1.00,
    "latlong": "9.30769,2.315834"
  },
  {
    "name": "Bermuda",
    "timezone_offset": -4.00,
    "latlong": "32.321384,-64.75737"
  },
  {
    "name": "Bhutan",
    "timezone_offset": 6.00,
    "latlong": "27.514162,90.433601"
  },
  {
    "name": "Bolivia",
    "timezone_offset": -4.00,
    "latlong": "-16.290154,-63.588653"
  },
  {
    "name": "Bosnia and Herzegovina",
    "timezone_offset": 1.00,
    "latlong": "43.9159,17.6791"
  },
  {
    "name": "Botswana",
    "timezone_offset": 2.00,
    "latlong": "-22.328474,24.684866"
  },
  {
    "name": "Brazil",
    "timezone_offset": -5.00,
    "latlong": "-14.235004,-51.92528"
  },
  {
    "name": "British Virgin Islands",
    "timezone_offset": -4.00,
    "latlong": "18.4207,-64.6400"
  },
  {
    "name": "Brunei",
    "timezone_offset": 8.00,
    "latlong": "4.535277,114.727669"
  },
  {
    "name": "Bulgaria",
    "timezone_offset": 2.00,
    "latlong": "42.733883,25.48583"
  },
  {
    "name": "Burkina Faso",
    "timezone_offset": 0.00,
    "latlong": "12.238333,-1.561593"
  },
  {
    "name": "Burma",
    "timezone_offset": 6.30,
    "latlong": "21.9162,95.9560"
  },
  {
    "name": "Burundi",
    "timezone_offset": 2.00,
    "latlong": "-3.373056,29.918886"
  },
  {
    "name": "Cambodia",
    "timezone_offset": 7.00,
    "latlong": "12.565679,104.990963"
  },
  {
    "name": "Cameroon",
    "timezone_offset": 1.00,
    "latlong": "7.369722,12.354722"
  },
  {
    "name": "Canada",
    "timezone_offset": -6.00,
    "latlong": "56.130366,-106.346771"
  },
  {
    "name": "Cape Verde",
    "timezone_offset": -1.00,
    "latlong": "16.002082,-24.013197"
  },
  {
    "name": "Cayman Islands",
    "timezone_offset": -5.00,
    "latlong": "19.3133,-81.2546"
  },
  {
    "name": "Central African Republic",
    "timezone_offset": 1.00,
    "latlong": "6.611111,20.939444"
  },
  {
    "name": "Chad",
    "timezone_offset": 1.00,
    "latlong": "15.4542,18.7322"
  },
  {
    "name": "Chile",
    "timezone_offset": -3.00,
    "latlong": "-35.675147,-71.542969"
  },
  {
    "name": "China",
    "timezone_offset": 8.00,
    "latlong": "35.86166,104.195397"
  },
  {
    "name": "Christmas Island",
    "timezone_offset": 7.00,
    "latlong": "-10.447525,105.690449"
  },
  {
    "name": "Clipperton Island",
    "timezone_offset": -8.00,
    "latlong": "10.2833,-109.2167"
  },
  {
    "name": "Cocos (Keeling) Islands",
    "timezone_offset": 6.30,
    "latlong": "-12.164165,96.870956"
  },
  {
    "name": "Colombia",
    "timezone_offset": -5.00,
    "latlong": "4.57086,-74.297333"
  },
  {
    "name": "Comoros",
    "timezone_offset": 3.00,
    "latlong": "-11.6455,43.3333"
  },
  {
    "name": "Congo, Democratic Republic of the",
    "timezone_offset": 1.00,
    "latlong": "-4.038333,21.758664"
  },
  {
    "name": "Cook Islands",
    "timezone_offset": -10.00,
    "latlong": "-21.236736,-159.777671"
  },
  {
    "name": "Costa Rica",
    "timezone_offset": -6.00,
    "latlong": "9.748917,-83.753428"
  },
  {
    "name": "Cote d'Ivoire",
    "timezone_offset": 0.00,
    "latlong": "7.539989,-5.54708"
  },
  {
    "name": "Croatia",
    "timezone_offset": 1.00,
    "latlong": "45.1000,15.2000"
  },
  {
    "name": "Cyprus",
    "timezone_offset": 2.00,
    "latlong": "35.126413,33.429859"
  },
  {
    "name": "Czech Republic",
    "timezone_offset": 1.00,
    "latlong": "49.817492,15.472962"
  },
  {
    "name": "Denmark",
    "timezone_offset": 1.00,
    "latlong": "56.26392,9.501785"
  },
  {
    "name": "Djibouti",
    "timezone_offset": 3.00,
    "latlong": "11.825138,42.590275"
  },
  {
    "name": "Dominica",
    "timezone_offset": -4.00,
    "latlong": "15.414999,-61.370976"
  },
  {
    "name": "Dominican Republic",
    "timezone_offset": -4.00,
    "latlong": "18.735693,-70.162651"
  },
  {
    "name": "Ecuador",
    "timezone_offset": -5.00,
    "latlong": "-1.831239,-78.183406"
  },
  {
    "name": "Egypt",
    "timezone_offset": 2.00,
    "latlong": "26.820553,30.802498"
  },
  {
    "name": "El Salvador",
    "timezone_offset": -6.00,
    "latlong": "13.794185,-88.89653"
  },
  {
    "name": "Equatorial Guinea",
    "timezone_offset": 1.00,
    "latlong": "1.650801,10.267895"
  },
  {
    "name": "Eritrea",
    "timezone_offset": 3.00,
    "latlong": "15.179384,39.782334"
  },
  {
    "name": "Estonia",
    "timezone_offset": 2.00,
    "latlong": "58.595272,25.013607"
  },
  {
    "name": "Ethiopia",
    "timezone_offset": 3.00,
    "latlong": "9.145,40.489673"
  },
  {
    "name": "Europa Island",
    "timezone_offset": 3.00,
    "latlong": "-22.3333,40.3667"
  },
  {
    "name": "Falkland Islands (Islas Malvinas)",
    "timezone_offset": -3.00,
    "latlong": "-51.796253,-59.523613"
  },
  {
    "name": "Faroe Islands",
    "timezone_offset": 0.00,
    "latlong": "61.892635,-6.911806"
  },
  {
    "name": "Fiji",
    "timezone_offset": 12.00,
    "latlong": "-16.578193,179.414413"
  },
  {
    "name": "Finland",
    "timezone_offset": 2.00,
    "latlong": "61.92411,25.748151"
  },
  {
    "name": "France",
    "timezone_offset": 1.00,
    "latlong": "46.227638,2.213749"
  },
  {
    "name": "French Guiana",
    "timezone_offset": -3.00,
    "latlong": "3.933889,-53.125782"
  },
  {
    "name": "French Polynesia",
    "timezone_offset": -10.00,
    "latlong": "-17.679742,-149.406843"
  },
  {
    "name": "French Southern and Antarctic Lands",
    "timezone_offset": 3.00,
    "latlong": "-49.280366,69.348557"
  },
  {
    "name": "Gabon",
    "timezone_offset": 1.00,
    "latlong": "-0.803689,11.609444"
  },
  {
    "name": "Gambia, The",
    "timezone_offset": 0.00,
    "latlong": "13.443182,-15.310139"
  },
  {
    "name": "Gaza Strip",
    "timezone_offset": 3.00,
    "latlong": "31.354676,34.308825"
  },
  {
    "name": "Georgia",
    "timezone_offset": 4.00,
    "latlong": "42.315407,43.356892"
  },
  {
    "name": "Germany",
    "timezone_offset": 1.00,
    "latlong": "51.165691,10.451526"
  },
  {
    "name": "Ghana",
    "timezone_offset": 0.00,
    "latlong": "7.946527,-1.023194"
  },
  {
    "name": "Gibraltar",
    "timezone_offset": 1.00,
    "latlong": "36.137741,-5.345374"
  },
  {
    "name": "Glorioso Islands",
    "timezone_offset": 4.00,
    "latlong": "11.5000,47.3333"
  },
  {
    "name": "Greece",
    "timezone_offset": 2.00,
    "latlong": "39.074208,21.824312"
  },
  {
    "name": "Greenland",
    "timezone_offset": -3.00,
    "latlong": "71.706936,-42.604303"
  },
  {
    "name": "Grenada",
    "timezone_offset": -4.00,
    "latlong": "12.262776,-61.604171"
  },
  {
    "name": "Guadeloupe",
    "timezone_offset": -4.00,
    "latlong": "16.995971,-62.067641"
  },
  {
    "name": "Guam",
    "timezone_offset": 10.00,
    "latlong": "13.444304,144.793731"
  },
  {
    "name": "Guatemala",
    "timezone_offset": -6.00,
    "latlong": "15.783471,-90.230759"
  },
  {
    "name": "Guernsey",
    "timezone_offset": 0.00,
    "latlong": "49.465691,-2.585278"
  },
  {
    "name": "Guinea",
    "timezone_offset": 0.00,
    "latlong": "9.945587,-9.696645"
  },
  {
    "name": "Guinea-Bissau",
    "timezone_offset": 0.00,
    "latlong": "11.803749,-15.180413"
  },
  {
    "name": "Guyana",
    "timezone_offset": -4.00,
    "latlong": "4.860416,-58.93018"
  },
  {
    "name": "Haiti",
    "timezone_offset": -5.00,
    "latlong": "18.971187,-72.285215"
  },
  {
    "name": "Heard Island and McDonald Islands",
    "timezone_offset": 5.00,
    "latlong": "-53.08181,73.504158"
  },
  {
    "name": "Holy See (Vatican City)",
    "timezone_offset": 1.00,
    "latlong": "41.902916,12.453389"
  },
  {
    "name": "Honduras",
    "timezone_offset": -6.00,
    "latlong": "15.199999,-86.241905"
  },
  {
    "name": "Hong Kong",
    "timezone_offset": 8.00,
    "latlong": "22.396428,114.109497"
  },
  {
    "name": "Howland Island",
    "timezone_offset": -12.00,
    "latlong": "0.8113,176.6183"
  },
  {
    "name": "Hungary",
    "timezone_offset": 1.00,
    "latlong": "47.162494,19.503304"
  },
  {
    "name": "Iceland",
    "timezone_offset": 0.00,
    "latlong": "64.963051,-19.020835"
  },
  {
    "name": "India",
    "timezone_offset": 5.30,
    "latlong": "20.593684,78.96288"
  },
  {
    "name": "Indonesia",
    "timezone_offset": 7.00,
    "latlong": "-0.789275,113.921327"
  },
  {
    "name": "Iran",
    "timezone_offset": 3.30,
    "latlong": "32.427908,53.688046"
  },
  {
    "name": "Iraq",
    "timezone_offset": 3.00,
    "latlong": "33.223191,43.679291"
  },
  {
    "name": "Ireland",
    "timezone_offset": 0.00,
    "latlong": "53.41291,-8.24389"
  },
  {
    "name": "Ireland, Northern",
    "timezone_offset": 0.00,
    "latlong": "54.7877,-6.4923"
  },
  {
    "name": "Israel",
    "timezone_offset": 2.00,
    "latlong": "31.046051,34.851612"
  },
  {
    "name": "Italy",
    "timezone_offset": 1.00,
    "latlong": "41.87194,12.56738"
  },
  {
    "name": "Jamaica",
    "timezone_offset": -5.00,
    "latlong": "18.109581,-77.297508"
  },
  {
    "name": "Jan Mayen",
    "timezone_offset": 1.00,
    "latlong": "77.553604,23.670272"
  },
  {
    "name": "Japan",
    "timezone_offset": 9.00,
    "latlong": "36.204824,138.252924"
  },
  {
    "name": "Jarvis Island",
    "timezone_offset": -11.00,
    "latlong": "0.3744,-159.9967"
  },
  {
    "name": "Jersey",
    "timezone_offset": 0.00,
    "latlong": "49.214439,-2.13125"
  },
  {
    "name": "Johnston Atoll",
    "timezone_offset": -10.00,
    "latlong": "16.7314,169.5344"
  },
  {
    "name": "Jordan",
    "timezone_offset": 2.00,
    "latlong": "30.585164,36.238414"
  },
  {
    "name": "Juan de Nova Island",
    "timezone_offset": 3.00,
    "latlong": "-17.0542,42.7247"
  },
  {
    "name": "Kazakhstan",
    "timezone_offset": 5.00,
    "latlong": "48.019573,66.923684"
  },
  {
    "name": "Kenya",
    "timezone_offset": 3.00,
    "latlong": "-0.023559,37.906193"
  },
  {
    "name": "Kiribati",
    "timezone_offset": 12.00,
    "latlong": "-3.370417,-168.734039"
  },
  {
    "name": "Korea, North",
    "timezone_offset": 8.30,
    "latlong": "40.339852,127.510093"
  },
  {
    "name": "Korea, South",
    "timezone_offset": 9.00,
    "latlong": "35.907757,127.766922"
  },
  {
    "name": "Kuwait",
    "timezone_offset": 3.00,
    "latlong": "29.31166,47.481766"
  },
  {
    "name": "Kyrgyzstan",
    "timezone_offset": 6.00,
    "latlong": "41.20438,74.766098"
  },
  {
    "name": "Laos",
    "timezone_offset": 7.00,
    "latlong": "19.85627,102.495496"
  },
  {
    "name": "Latvia",
    "timezone_offset": 2.00,
    "latlong": "56.879635,24.603189"
  },
  {
    "name": "Lebanon",
    "timezone_offset": 2.00,
    "latlong": "33.854721,35.862285"
  },
  {
    "name": "Lesotho",
    "timezone_offset": 2.00,
    "latlong": "-29.609988,28.233608"
  },
  {
    "name": "Liberia",
    "timezone_offset": 0.00,
    "latlong": "56.879635,24.603189"
  },
  {
    "name": "Libya",
    "timezone_offset": 1.00,
    "latlong": "26.3351,17.22833"
  },
  {
    "name": "Liechtenstein",
    "timezone_offset": 1.00,
    "latlong": "47.166,9.555373"
  },
  {
    "name": "Lithuania",
    "timezone_offset": 2.00,
    "latlong": "55.169438,23.881275"
  },
  {
    "name": "Luxembourg",
    "timezone_offset": 1.00,
    "latlong": "49.815273,6.129583"
  },
  {
    "name": "Macau",
    "timezone_offset": 8.00,
    "latlong": "22.198745,113.543873"
  },
  {
    "name": "Macedonia, Former Yugoslav Republic of",
    "timezone_offset": 1.00,
    "latlong": "41.608635,21.745275"
  },
  {
    "name": "Madagascar",
    "timezone_offset": 3.00,
    "latlong": "-18.766947,46.869107"
  },
  {
    "name": "Malawi",
    "timezone_offset": 2.00,
    "latlong": "-13.254308,34.301525"
  },
  {
    "name": "Malaysia",
    "timezone_offset": 8.00,
    "latlong": "4.210484,101.975766"
  },
  {
    "name": "Maldives",
    "timezone_offset": 5.00,
    "latlong": "3.202778,73.22068"
  },
  {
    "name": "Mali",
    "timezone_offset": 0.00,
    "latlong": "17.570692,-3.996166"
  },
  {
    "name": "Malta",
    "timezone_offset": 0.00,
    "latlong": "35.937496,14.375416"
  },
  {
    "name": "Man, Isle of",
    "timezone_offset": 0.00,
    "latlong": "54.236107,-4.548056"
  },
  {
    "name": "Marshall Islands",
    "timezone_offset": 12.00,
    "latlong": "7.131474,171.184478"
  },
  {
    "name": "Martinique",
    "timezone_offset": -4.00,
    "latlong": "14.641528,-61.024174"
  },
  {
    "name": "Mauritania",
    "timezone_offset": 0.00,
    "latlong": "21.00789,-10.940835"
  },
  {
    "name": "Mauritius",
    "timezone_offset": 4.00,
    "latlong": "-20.348404,57.552152"
  },
  {
    "name": "Mayotte",
    "timezone_offset": 3.00,
    "latlong": "-12.8275,45.166244"
  },
  {
    "name": "Mexico",
    "timezone_offset": -6.00,
    "latlong": "23.634501,-102.552784"
  },
  {
    "name": "Micronesia, Federated States of",
    "timezone_offset": 10.00,
    "latlong": "7.425554,150.550812"
  },
  {
    "name": "Midway Islands",
    "timezone_offset": -11.00,
    "latlong": "28.2101,-177.3761"
  },
  {
    "name": "Moldova",
    "timezone_offset": 2.00,
    "latlong": "47.411631,28.369885"
  },
  {
    "name": "Monaco",
    "timezone_offset": 1.00,
    "latlong": "43.750298,7.412841"
  },
  {
    "name": "Mongolia",
    "timezone_offset": 8.00,
    "latlong": "46.862496,103.846656"
  },
  {
    "name": "Montserrat",
    "timezone_offset": -4.00,
    "latlong": "16.742498,-62.187366"
  },
  {
    "name": "Morocco",
    "timezone_offset": 0.00,
    "latlong": "31.791702,-7.09262"
  },
  {
    "name": "Mozambique",
    "timezone_offset": 2.00,
    "latlong": "-18.665695,35.529562"
  },
  {
    "name": "Namibia",
    "timezone_offset": 1.00,
    "latlong": "-22.95764,18.49041"
  },
  {
    "name": "Nauru",
    "timezone_offset": 12.00,
    "latlong": "-0.522778,166.931503"
  },
  {
    "name": "Nepal",
    "timezone_offset": 5.45,
    "latlong": "28.394857,84.124008"
  },
  {
    "name": "Netherlands",
    "timezone_offset": 1.00,
    "latlong": "52.132633,5.291266"
  },
  {
    "name": "Netherlands Antilles",
    "timezone_offset": -4.00,
    "latlong": "12.226079,-69.060087"
  },
  {
    "name": "New Zealand",
    "timezone_offset": 12.00,
    "latlong": "-40.900557,174.885971"
  },
  {
    "name": "Nicaragua",
    "timezone_offset": -6.00,
    "latlong": "12.865416,-85.207229"
  },
  {
    "name": "Niger",
    "timezone_offset": 1.00,
    "latlong": "17.607789,8.081666"
  },
  {
    "name": "Nigeria",
    "timezone_offset": 1.00,
    "latlong": "9.081999,8.675277"
  },
  {
    "name": "Niue",
    "timezone_offset": -11.00,
    "latlong": "-19.054445,-169.867233"
  },
  {
    "name": "Norfolk Island",
    "timezone_offset": 11.30,
    "latlong": "-29.040835,167.954712"
  },
  {
    "name": "Northern Mariana Islands",
    "timezone_offset": 10.00,
    "latlong": "17.33083,145.38469"
  },
  {
    "name": "Norway",
    "timezone_offset": 1.00,
    "latlong": "60.472024,8.468946"
  },
  {
    "name": "Oman",
    "timezone_offset": 4.00,
    "latlong": "21.512583,55.923255"
  },
  {
    "name": "Pakistan",
    "timezone_offset": 5.00,
    "latlong": "30.375321,69.345116"
  },
  {
    "name": "Palau",
    "timezone_offset": 9.00,
    "latlong": "7.51498,134.58252"
  },
  {
    "name": "Panama",
    "timezone_offset": -5.00,
    "latlong": "8.537981,-80.782127"
  },
  {
    "name": "Papua New Guinea",
    "timezone_offset": 10.00,
    "latlong": "-6.314993,143.95555"
  },
  {
    "name": "Paraguay",
    "timezone_offset": -4.00,
    "latlong": "-23.442503,-58.443832"
  },
  {
    "name": "Peru",
    "timezone_offset": -5.00,
    "latlong": "-9.189967,-75.015152"
  },
  {
    "name": "Philippines",
    "timezone_offset": 8.00,
    "latlong": "12.879721,121.774017"
  },
  {
    "name": "Pitcaim Islands",
    "timezone_offset": -8.00,
    "latlong": "-24.703615,-127.439308"
  },
  {
    "name": "Poland",
    "timezone_offset": 1.00,
    "latlong": "51.919438,19.145136"
  },
  {
    "name": "Portugal",
    "timezone_offset": 0.00,
    "latlong": "39.399872,-8.224454"
  },
  {
    "name": "Puerto Rico",
    "timezone_offset": -4.00,
    "latlong": "18.220833,-66.590149"
  },
  {
    "name": "Qatar",
    "timezone_offset": 3.00,
    "latlong": "25.354826,51.183884"
  },
  {
    "name": "Reunion",
    "timezone_offset": 4.00,
    "latlong": "-21.115141,55.536384"
  },
  {
    "name": "Romainia",
    "timezone_offset": 2.00,
    "latlong": "45.943161,24.96676"
  },
  {
    "name": "Russia",
    "timezone_offset": 0.00,
    "latlong": "61.52401,105.318756"
  },
  {
    "name": "Rwanda",
    "timezone_offset": 2.00,
    "latlong": "-1.940278,29.873888"
  },
  {
    "name": "Saint Helena",
    "timezone_offset": 0.00,
    "latlong": "-24.143474,-10.030696"
  },
  {
    "name": "Saint Kitts and Nevis",
    "timezone_offset": -4.00,
    "latlong": "17.357822,-62.782998"
  },
  {
    "name": "Saint Lucia",
    "timezone_offset": -4.00,
    "latlong": "13.909444,-60.978893"
  },
  {
    "name": "Saint Pierre and Miquelon",
    "timezone_offset": -3.00,
    "latlong": "46.941936,-56.27111"
  },
  {
    "name": "Saint Vincent and the Grenadines",
    "timezone_offset": -4.00,
    "latlong": "12.984305,-61.287228"
  },
  {
    "name": "Samoa",
    "timezone_offset": 13.00,
    "latlong": "-13.759029,-172.104629"
  },
  {
    "name": "San Marino",
    "timezone_offset": 1.00,
    "latlong": "43.94236,12.457777"
  },
  {
    "name": "Sao Tome and Principe",
    "timezone_offset": 0.00,
    "latlong": "0.18636,6.613081"
  },
  {
    "name": "Saudi Arabia",
    "timezone_offset": 3.00,
    "latlong": "23.885942,45.079162"
  },
  {
    "name": "Scotland",
    "timezone_offset": 0.00,
    "latlong": "56.4907,-4.2026"
  },
  {
    "name": "Senegal",
    "timezone_offset": 0.00,
    "latlong": "14.497401,-14.452362"
  },
  {
    "name": "Seychelles",
    "timezone_offset": 4.00,
    "latlong": "-4.679574,55.491977"
  },
  {
    "name": "Sierra Leone",
    "timezone_offset": 0.00,
    "latlong": "8.460555,-11.779889"
  },
  {
    "name": "Singapore",
    "timezone_offset": 8.00,
    "latlong": "1.352083,103.819836"
  },
  {
    "name": "Slovakia",
    "timezone_offset": 1.00,
    "latlong": "48.669026,19.699024"
  },
  {
    "name": "Slovenia",
    "timezone_offset": 1.00,
    "latlong": "46.151241,14.995463"
  },
  {
    "name": "Solomon Islands",
    "timezone_offset": 11.00,
    "latlong": "-9.64571,160.156194"
  },
  {
    "name": "Somalia",
    "timezone_offset": 3.00,
    "latlong": "5.152149,46.199616"
  },
  {
    "name": "South Africa",
    "timezone_offset": 2.00,
    "latlong": "-30.559482,22.937506"
  },
  {
    "name": "South Georgia and South Sandwich Islands",
    "timezone_offset": -2.00,
    "latlong": "-54.429579,-36.587909"
  },
  {
    "name": "Spain",
    "timezone_offset": 1.00,
    "latlong": "40.463667,-3.74922"
  },
  {
    "name": "Sri Lanka",
    "timezone_offset": 5.30,
    "latlong": "7.873054,80.771797"
  },
  {
    "name": "Sudan",
    "timezone_offset": 3.00,
    "latlong": "12.862807,30.217636"
  },
  {
    "name": "Suriname",
    "timezone_offset": -3.00,
    "latlong": "3.919305,-56.027783"
  },
  {
    "name": "Svalbard",
    "timezone_offset": 1.00,
    "latlong": "77.553604,23.670272"
  },
  {
    "name": "Swaziland",
    "timezone_offset": 2.00,
    "latlong": "-26.522503,31.465866"
  },
  {
    "name": "Sweden",
    "timezone_offset": 1.00,
    "latlong": "60.128161,18.643501"
  },
  {
    "name": "Switzerland",
    "timezone_offset": 1.00,
    "latlong": "46.818188,8.227512"
  },
  {
    "name": "Syria",
    "timezone_offset": 2.00,
    "latlong": "34.802075,38.996815"
  },
  {
    "name": "Taiwan",
    "timezone_offset": 8.00,
    "latlong": "23.69781,120.960515"
  },
  {
    "name": "Tajikistan",
    "timezone_offset": 5.00,
    "latlong": "38.861034,71.276093"
  },
  {
    "name": "Tanzania",
    "timezone_offset": 3.00,
    "latlong": "-6.369028,34.888822"
  },
  {
    "name": "Thailand",
    "timezone_offset": 7.00,
    "latlong": "15.870032,100.992541"
  },
  {
    "name": "Tobago",
    "timezone_offset": -4.00,
    "latlong": "10.691803,-61.222503"
  },
  {
    "name": "Togo",
    "timezone_offset": 0.00,
    "latlong": "8.619543,0.824782"
  },
  {
    "name": "Tokelau",
    "timezone_offset": 13.00,
    "latlong": "-8.967363,-171.855881"
  },
  {
    "name": "Tonga",
    "timezone_offset": 13.00,
    "latlong": "-21.17898,-175.198242"
  },
  {
    "name": "Trinidad",
    "timezone_offset": 13.00,
    "latlong": "10.691803,-61.222503"
  },
  {
    "name": "Tunisia",
    "timezone_offset": 1.00,
    "latlong": "33.886917,9.537499"
  },
  {
    "name": "Turkey",
    "timezone_offset": 2.00,
    "latlong": "38.963745,35.243322"
  },
  {
    "name": "Turkmenistan",
    "timezone_offset": 5.00,
    "latlong": "38.969719,59.556278"
  },
  {
    "name": "Tuvalu",
    "timezone_offset": 12.00,
    "latlong": "-7.109535,177.64933"
  },
  {
    "name": "Uganda",
    "timezone_offset": 3.00,
    "latlong": "1.373333,32.290275"
  },
  {
    "name": "Ukraine",
    "timezone_offset": 2.00,
    "latlong": "48.379433,31.16558"
  },
  {
    "name": "United Arab Emirates",
    "timezone_offset": 4.00,
    "latlong": "23.424076,53.847818"
  },
  {
    "name": "United Kingdom",
    "timezone_offset": 0.00,
    "latlong": "55.378051,-3.435973"
  },
  {
    "name": "Uruguay",
    "timezone_offset": -3.00,
    "latlong": "-32.522779,-55.765835"
  },
  {
    "name": "USA",
    "timezone_offset": -5.00,
    "latlong": "37.09024,-95.712891"
  },
  {
    "name": "Uzbekistan",
    "timezone_offset": 5.00,
    "latlong": "41.377491,64.585262"
  },
  {
    "name": "Vanuatu",
    "timezone_offset": 11.00,
    "latlong": "-15.376706,166.959158"
  },
  {
    "name": "Venezuela",
    "timezone_offset": -4.30,
    "latlong": "6.42375,-66.58973"
  },
  {
    "name": "Vietnam",
    "timezone_offset": 7.00,
    "latlong": "14.058324,108.277199"
  },
  {
    "name": "Virgin Islands",
    "timezone_offset": -4.00,
    "latlong": "18.335765,-64.896335"
  },
  {
    "name": "Wales",
    "timezone_offset": 10.00,
    "latlong": "52.1307,-3.7837"
  },
  {
    "name": "Wallis and Futuna",
    "timezone_offset": 12.00,
    "latlong": "-13.768752,-177.156097"
  },
  {
    "name": "West Bank",
    "timezone_offset": 3.00,
    "latlong": "31.9428,35.2572"
  },
  {
    "name": "Western Sahara",
    "timezone_offset": 1.00,
    "latlong": "24.215527,-12.885834"
  },
  {
    "name": "Yemen",
    "timezone_offset": 3.00,
    "latlong": "15.552727,48.516388"
  },
  {
    "name": "Zambia",
    "timezone_offset": 1.00,
    "latlong": "-13.133897,27.849332"
  },
  {
    "name": "Zimbabwe",
    "timezone_offset": 2.00,
    "latlong": "-19.015438,29.154857"
  }
];