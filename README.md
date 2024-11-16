# Metric Server
Metric.im server for pinging and reporting event data.

## Usage
```bash
npm install @metric-im/metric-server
```
The module can be integrated into host and invoked directly
```javascript
import MetricServer from '@metric-im/metric-server';
// Get the application interface
const metricApi = await MetricServer.getApi(mongo.db(),{}); // insert relevant database reference
// Record an event with ping([body])
let eventBody = metricApi.initializeEvent('myAccount',req); // Optionally parse web request. Account name is arbitrary
await metricApi.ping(Object.assign(eventBody,{hi:"hello",color:"green"})); // Ping body is context and custom data
// Retrieve event data with pull([account],[path],[options])
let account={id:'myAccount',super:true}; // create a stub account to bypass metric access control
let results = await metricApi.pull(account,req.params[0],req.query,res); // path identifies format, namespace, dimensions & metrics
```
The body sent to ping can be anything, though complex objects are less useful than flat objects.
All events are recorded with a timestamp, namespace, account and unique identifier. Additional
attributes are arbitrary. The namespace helps interpret the attributes and generate derived data,
but is not required.

The path identifies the output format (such as raw json or a pie chart), namespace, dimensions and
metrics. Dimensions organize the results into "columns" while metrics perform aggregate math on
the data set that satisfies all dimensions, a "row".

Please refer to the [Reference Guide](#ReferenceGuide) for details, syntax and options.

## Deployment Notes
This package relies on the metric-im/wiki-mixin which requires JRE for graphics. This dependency
is not important to metric-server and will be removed.

```bash
sudo apt-get install -y openjdk-8-jdk
sudo apt-get install -y graphviz
```
The package.json references dotenv. Install dotenv globally
```bash
sudo npm i -g dotenv
```
The event collection should have a wildcard index. We don't know which attributes
are going to be used as dimensions, making them keys. The event id (_id), time
stamp (_time), and namespace (_ns) are commonly used.
```
metric> db.event.getIndexes()
[
  { v: 2, key: { _id: 1 }, name: '_id_' },
  { v: 2, key: { '$**': 1 }, name: '$**_1' },
  { v: 2, key: { _ns: 1 }, name: '_ns_1' },
  { v: 2, key: { _time: 1 }, name: '_time_1' }
]
```

# <a name="ReferenceGuide"></a>Reference Guide

The metric server is essentially an abstraction of Mongo's rich aggregation waterfall applied
to an arbitrary set of atomic events. An event has an ID and a Time Stamp. All other data is
whatever needs to be recorded to capture the relevant context of the event. In addition to
event recording (ping) and event analysis and reporting (pull), there are a few additional
methods to maintain the collection.

* [ping()](#EventPing) - Record an event including an arbitrary set of data points
* [pull()](#EventPull) - Query the event collection to produce raw data, charts or tables
* [initializeEvent()](#InitializeEvent) - An event triggered with a web call is parsed for context such as user agent and IP (which is not recorded)
* [ontology()](#EventOntology) - Manage the ontology that defines the namespaces and field handling
* [redact()](#RedactEvent) - Remove an event. Avoid changing the event history whenever possible
* [analysis()](#EventAnalysis) - Sample the event collection to examine the fields available, some values and the interpreted data types

> NOTE: Ontology, redact and analysis are not yet available through the imported Api, only the web routes

## <a name="EventPing"></a>Ping()
> *syntax*: `PUT|GET /ping/{format}/{namespace}[?[attribute=value]]`

| name | description |
|---|---|
| format | Determines the return type of the request. See Ping Return Formats |
| namespace | Identifies the event namespace. This governs access and attribute data types |
| attribute=value | The query string can include any number of attribute value pairs to be queried with pull |

Using PUT, attributes can be provided through the body rather than query string. This is preferable because
integers and floats can be passed, rather than just strings. Declared attributes will be cast into the specified
data type regardless.

The body of a PUT may be provided as an array, in which case each array entry is treated as an individual event.

### Ping Return Formats

* *silent* - returns 204 success status with no payload
* *pixel* - returns a 1x1 transparent png
* *script* - returns an empty payload with application/javascript mime type
* *json* - returns the object recorded for the event
* *table* - returns an html table of name value pairs

Any other tag will return an empty 204, same as *silent*.

### System Values
`_time`, `_ns` and `_account` are added automatically. If `_time` is provided as an event attribute,
it will override the default.

If the namespace selects any refiners, each is executed with the base event object and the request
context. This context includes hostname, url, ip and ua (user agent). These values can be provided
explicitly by defining _origin as attribute. It is expected to be an object with one or more of these
context values defined. _context, if present is removed from the event record before being written.

### Ping Examples
`https://metric.im/ping/silent/navigation?site=hello.com&path=/about`

## <a name="EventPull"></a>Pull()
> *syntax*: `GET /pull/{format}/{namespace}/{dimension[:{qualifier}]}/[{metrics[:aggregation]}][?{option}[&{option}]]`

| name | description |
|---|---|
| format | Determines the format of the result. This includes: json, table, csv and chart |
| namespace | Identifies the event namespace. This governs access and attribute data types |
| dimensions | Comma separated list of one or more dimensions. Dimension values organize results for metric aggregation |
| qualifier | A dimension can be qualified by following it with a colon and a limiter. The simplest is an explicit match value, but ranges and even mongo statements can be used. |
| metrics | Metrics are the attribute values that are measured. Metrics should be declared in to specify the aggregation method and display formatting. |
| option | Options to modify the results |

### Aggregation methods
The metrics for each record that matches the given dimensions is run the a formula to produce a single result. The built in formulas are sum, avg, first, last, min, max, etc. These are define by mongo. See [MongoDB group accumulators](https://www.mongodb.com/docs/manual/reference/operator/aggregation/#std-label-agg-operators-group-accumulators)

In addition, Metric.im supports custom accumulators that can be defined for a namespace.

### Options
| option | default | description |                                                                                                                  
| --- | --- |---| 
| sort | _id | sort can be a field name or a mongo sort object, such as `{modified:-1}`. Note that all _id fields are natively date sorted. |
| days | | limit the results to look back only the specified number of days. |
| since | | identify only records *since* a give date specified as YYYY-MM-DD. "Since" can be used in conjunction with "days" |
| where | | apply a match statement to the request. The value should be in mongo syntax. This can usually be done by qualifying dimensions. `where={name:"Alice"}` is equivalent to `/name:Alice` in the dimension path. |

### Formats
| name | mimetype | description |
| --- | --- |---| 
| json | application/json | raw object format ideal for programmatic results |
| csv | text/plain | comma separated grid for use with spreadsheets |
| table | text/html | HTML page with embedded TABLE element. Includes simple styling |
| chart | text/html | HTML page with embedded chartjs object. To select a chart type other than bar, use dot notation. i.e chart.pie. |
| map | text/html | HTML page with a google map object. The dataset must include latitude and longitude. The rendering is a marker for each object, but with dot notation heatmap or polyline path can be rendered |

See https://chartjs.org for more information about chart rendering. Metric flips and adjusts data to adjust to match the chart type. The following types render relevant results:

* chart[.bar] (default)
* chart.line
* chart.pie
* chart.doughnut
* chart.radar
* chart.polarArea

For *map* formats, the result set must include attributes for latitude and longitude (dimensions or metrics). Any other
attributes are inserted as hover text. The following rendering options are available

* map[.marker] - puts a pin in the map
* map.path - trace a line from each point
* map.heat - visualize the concentration of points

#### Common Format options.
* *.nolegend* - Hides the label text on graphs. For example, `/chart.bar.nolegend`
* *.file* - returns a file with the results rather than displaying on screen. Not available for graphs or maps.

### Dimension Qualifiers

A dimension name can be followed by a colon and a qualifier to limit the result set for the dimension.
The dimension is included in the result set as usual. An understanding mongo syntax is helpful. 

`name:value`

Adds to the where clause as, `{"name":"value:}`. For example, `country:US` becomes `{$where:{country:"US"}}`

If value is in curly brackets it is considered a syntactically loose JSON object. For example
`country:{exists:true}` is added as `{$where:{country:{$exists:true}}}`

If value is in square braces it interpreted as a where-in clause. For example `country:[US,RU]`
becomes `{$where:{country:{$in:["US","RU"]}}}`

If value is in parentheses it is interpreted as a foreign _id lookup. For example `country:(countries,name)`
adds a $lookup to the query pipeline as
```
{$lookup:{from:"countries",localField:"country",foreignField:"_id",as:"country}}
{$unwind:"country"}
{$project:{"country.name":"name"}}
```
The first parameter given in the parens is the collection name. The one or more following parameters are
included as dimensions.
>*NOTE:* Lookup qualifiers is not yet fully implemented


### Pull examples
Number of posts by day
```http request
/pull/chart.bar.nolegend/sezus/date/_count?sort=date&where={action:create}
```
Reactions
```http request
/pull/chart.line/sezus/date/like,dislike,important,badFaith,troll,insightful,misleading
```
Activity by country
```http request
/pull/chart.pie/sezus/country/_count?sort=_count:-1&limit=8
```
Geographic Activity (activity centered in a country indicates we have no further detail)
```http request
/pull/map.heat/sezus/_id/latitude:last,longitude:last
```
Total number of posts... all events where action is 'create'
```http request
/pull/json/sezus/action:create/_count
--or--
/pull/json/sezus/action/_count?where=action:create
```

## <a name="InitializeEvent"></a>initializeEvent()
InitializeEvent is a convenience function. It reads the expressjs request object for context data.
Source data, such as the user agent string and IP address, is placed in the _origin block of the event. This can
be used by the refiners, but is not stored with the event record when PII is a concern.

## <a name="EventOntology"></a>ontology()
The ontology defines the meta data behind the namespaces and attribute. This is generally used only by the system.

> *syntax*: `GET /ontology/ns[/{namespaceId}][/fields]`

Without specifying *namespaceId*, the request returns all namespaces explicitly available to this account (excluding public namespaces). By providing a namespaceId the result is the full namespace record and the fields explicitly defined to that namespace.

Append the query with `/fields` and the result is all the attributes, including inherited attributes that are defined to this namespace.

## <a name="RedactEvent"></a>redact()
> *syntax*: `GET /redact/{namespace}[/id,...][?{since}]`

Remove events from the system

| name | description |
|---|---|
| namespace | Identifies the event namespace. This governs access and attribute data types. You must have admin privileges to a namespace to remove events |
| id | Optionally provide one or more explicit event id's, separated by commas. This will remove the specifically identified events |
| since | enter any combination of minutes=value, hours=value and or days=value to instruct redaction of events newer than now minus the time specified |

## <a name="EventAnalysis"></a>analysis()
> *syntax*: `GET /analysis/{namespace}`

Analysis is a tool to assist in writing pull requests. It is a schema of the data derived from a
sample of events. Some event fields will be named and typed in the Ontology. If not, the engine
guesses the datatype based on the existing values.

# Design Concepts

## <a name="RefineryAndPlugins"></a>Refinery and Plugins
### Refiners Available
## <a name="OntologyEditing"></a>Ontology Editing
### Field Specifications
### Derived fields
### Namespace Inheritance
## <a name="NamedQueries"></a>Named Queries

## <a name="Optimization"></a>Optimization
## <a name="EventRefinery"></a>Event Refinery
## <a name="EventRefinery"></a>Event Refinery

## Reserved Attribute Names
* year - YYYY
* monthName - January, February, ...
* month - 1-12
* day - 1-31
* hour - 0-60
* minute - 0-60
* second - 0-60
* week - 1-52
* weekday - Sunday, Monday, ...
* date - YYYY-MM-DD
* _time - now
* _ns - event name space or "ping"
* _account - authorized account or "public"


