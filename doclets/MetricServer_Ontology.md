# Metric Server

The metric server provides a dynamic yet light-weight mechanism to capture and present
data across domains and disciplines. It provides a pure http API as well as a NPM import
module.

__Ping__ sends event data. __Pull__ renders that data with a rich query structure and many
output options, from JSON to Pie Charts. The __Ontology__ assists with data casting, derived
attributes and plugins that can embellish or alter the incoming events and presentation
formatting.

Metric uses a schemaless event collection. Every attribute in an event record can be queried
as either a dimension, which establish the dataset to be organized and analyzed, or a metric,
which measures the data. Generally, attributes with finite value sets (countries, weekday) are
dimensions while numbers measure the dimensions as metrics

```http request
https://metric.im/ping/postevent?firstname=Alice&lastname=Smith,country=US
https://metric.im/ping/postevent?firstname=Bob&lastname=Smith,country=UK
...
https://metric.im/pull/table/postevent/day,lastname,firstname,country/_count
```
THe pull request results in a table with four columns. Each row is distinct on day, lastname,
firstname and country, and sums the number of times this combination of constants appears
in the data. The result set is limited to the account that recorded the event and the
namespace, 'postevent' in this example.

>NOTE: The dimension, country, is here explicitly provided. If the intent is to examine
> instead the origin of the request, country can be derived by refiner during ingestion.

~~~~plantuml
@startuml
[event source]
[event analyzer]
package "metric server" {
  [pull] --> [ontology]
  [pull] <-- [event analyzer]
  [ping] --> [ontology]
  [ping] --> [refinery]
  [ping] <-right- [event source]

}
@enduml
~~~~

| service | path | description |
|---|---|--- |
| Ping | /ping | Post an event to metric.im. |
| Pull | /pull | Request event data through dimensions and metrics. |
| Ontology | /ontology | Access to namespace and data type definitions. |
| Schema | /schema | Displays a sampling of attributes available for the given namespace |


## Ping

> *syntax*: `PUT|GET /ping/{format}/{namespace}[?[attribute=value]]`

| name | description |
|---|---|
| format | Determines the return type of the request. See Ping Return Formats |
| namespace | Identifies the event namespace. This governs access and attribute data types |
| attribute=value | The query string can include any number of attribute value pairs to be queried with pull |

Using PUT, attributes can be provided through the body rather than query string. This is preferable because integers and floats can be passed, rather than just strings. Declared attributes will be cast into the specified data type regardless.

The body of a PUT may be provided as an array, in which case each array entry is treated as an individual event.

### Ping Return Formats

* *silent* - returns 204 success status with no payload
* *pixel* - returns a 1x1 transparent png
* *script* - returns an empty payload with application/javascript mime type
* *json* - returns the object recorded for the event
* *table* - returns an html table of name value pairs

Any other tag will return an empty 204, same as *silent*.

### System Values
`_time`, `_ns` and `_account` are added automatically. If `_time` is provided as an event attribute, it will override the default.


If the namespace selects any refiners, each is executed with the base event object and the request context. This context includes hostname, url, ip and ua (user agent). These values can be provided explicitly by defining _origin as attribute. It is expected to be an object with one or more of these context values defined. _context, if present is removed from the event record before being written.


### Ping Examples

`https://metric.im/ping/silent/navigation?site=hello.com&path=/about`

## Pull

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

For *map* formats, the result set must include attributes for latitude and longitude (dimensions or metrics). Any other attributes are inserted as hover text. The following rendering options are available

* map[.marker] - puts a pin in the map
* map.path - trace a line from each point
* map.heat - visualize the concentration of points


### Pull examples

## Ontology

The ontology defines the meta data behind the namespaces and attribute. This is generally used only by the system.

> *syntax*: `GET /ontology/ns[/{namespaceId}][/fields]`

Without specifying *namespaceId*, the request returns all namespaces explicitly available to this account (excluding public namespaces). By providing a namespaceId the result is the full namespace record and the fields explicitly defined to that namespace.

Append the query with `/fields` and the result is all the attributes, including inherited attributes that are defined to this namespace.

## Redact

> *syntax*: `GET /redact/{namespace}[/id,...][?{since}]`

Remove events from the system

| name | description |
|---|---|
| namespace | Identifies the event namespace. This governs access and attribute data types. You must have admin privileges to a namespace to remove events |
| id | Optionally provide one or more explicit event id's, separated by commas. This will remove the specifically identified events |
| since | enter any combination of minutes=value, hours=value and or days=value to instruct redaction of events newer than now minus the time specified |

