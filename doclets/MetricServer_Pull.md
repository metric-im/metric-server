# Pull
> *syntax*: `GET /pull/{format}/{namespace}/[<>+!]{dimension[:match|~series]}/[{metrics[:aggregation]}][?{option}[&{option}]]`

| name             | description                                                                                                                                                                  |
|------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| format           | Determines the format of the result. This includes: json, table, csv and chart. Required.                                                                                    |
| namespace        | Identifies the event namespace. This governs access and attribute data types. Required.                                                                                      |
| dimensions       | Comma separated list of one or more dimensions. Dimension values organize results for metric aggregation. Required                                                           |
| :match           | A dimension can be qualified by following it with a colon and a mongo match statement. The simplest is an explicit match value, See docs for shortcut syntax.                |
| ~series          | A dimension can root a series with the percent sign. For numbers it irons out precision. It is most commonly used for dates where the modifier word is like 'hour' or 'day'. |
| metrics          | Metrics are the attribute values that are measured. Metrics should be declared in to specify the aggregation method and display formatting.                                  |
| option           | Options to modify the results                                                                                                                                                |
| organizer @+><!  | dimensions can be assigned, combined, compressed, spread or skipped. This helps with graphing, json structuring and table formatting.                                        |

Pull runs an aggregation query on the event collection. *Dimensions* are event fields that qualify the result set.
*Metrics* are event fields to be measured within the event set. For example, given the dimensions _date_ and _page_ and the
metric _click_, return the number of clicks for a page on a date. The results can be returned as a chart, a table, a file,
json, etc. Qualifiers customize the results. It is intended to answer most simple data queries without the introduction
of new functions.

## Formats
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

### Common Format options.
Dot notation is used to pass options to the format output. Order is not relevant

* *.nolegend* - Hides the label text on graphs. For example, `/chart.bar.nolegend`
* *.file* - returns a file with the results rather than displaying on screen. Not available for graphs or maps.
* *.print* - returns a page formatted without chrome for printing. (not yet implemented)

## Aggregation methods
The metrics for each record that matches the given dimensions are run through an accumulator. Any of the built-in mongo accumulators
may be provided, such as sum, avg, first, last, min, max, addToSet. See [MongoDB group accumulators](https://www.mongodb.com/docs/manual/reference/operator/aggregation/#std-label-agg-operators-group-accumulators). The default is 'sum'.

In addition, Metric.im can use any custom accumulators defined in `metric-server/accumulators`. A few have been provided:

| name             | description                                                                          |
|------------------|--------------------------------------------------------------------------------------|
| change           | Provides the change between the current value and the last value                     |
| degreeChange     | provides the change between the current value and the last value, expressed in degrees |
| expMovingAverage | Moving average for the input metric. Look back ten records or provided number, i.e. :expMovingAverage.15 |
| ratio            | The ratio of this metric calculated across the given dimensions   |

## Options
| option   | default | description                                                                                                                                                                                                          |                                                                                                                  
|----------| --- |----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------| 
| sort     | _id | sort can be a field name or a mongo sort object, such as `{modified:-1}`. Note that many _id fields are natively date sorted.                                                                                        |
| days     | | limit the results to look back only the specified number of days.                                                                                                                                                    |
| since    | | identify only records *since* a given date specified as parseable ISO string, i.e. YYYY-MM-DD. "Since" can be used in conjunction with "days"                                                                        |
| where    | | apply a match statement to the request. The value should be in mongo syntax. This can usually be done by qualifying dimensions as well. `where={name:"Alice"}` is equivalent to `/name:Alice` in the dimension path. |
| limit    | | truncates the results after the number of records given. i.e. limit=20 will only return the first twenty records.                                                                                                    
| first    | | slice and return first last record in the result set                                                                                                                                                                 | 
| last     | | slice and return the last record in the result set                                                                                                                                                                   | 
| _inspect | | if set to 'true' or '1' returns the mongo query statement rather than running it. This is useful for understanding how the query is interpreted.                                                                     |

## Dimension Match Modifier (:match)

A dimension name can be followed by a colon and a qualifier to modify/limit the result set for the dimension.
Much of this functionality can be expressed with the `where` option.
<a href='https://github.com/jsonicjs/jsonic'>Jsonic</a> parsing is used to be super lax and readable. 

`name:value`

Adds to the aggregation pipeline `{$match:{name:"value"}}`.

If value is in square braces it interpreted as a where-in clause. For example `country:[US,RU]`
becomes `{$match:{country:{$in:["US","RU"]}}}`

If the value includes a tilde

If value is in parentheses it is interpreted as a foreign _id lookup. For example `country:(countries,name)`
adds a $lookup to the aggregation pipeline as
```
{$lookup:{from:"countries",localField:"country",foreignField:"_id",as:"country}}
{$unwind:"country"}
{$project:{"country.name":"$name"}}
```
The first parameter given in the parens is the collection name. The one or more following parameters are
included as dimensions.
>*NOTE:* Lookup qualifiers requires the host to explicitly set collections that are allowed to be referenced.
> This isn't implemented yet.

## Series Spread Modifier (~series)

The series modifier forces the dimension into consistent units and fills in missing entries. The datatype
dictates how it functions. If the datatype isn't a number or date, the directive is ignored. This is
primarily intended for drawing charts.

### Number Series

The dimension value has precision removed by dividing by the series value, averaged to a whole number, and multiplied
back. For example `grade~10` will translate the grade values of 78 and 92 to 70 and 90 respectively.
Missing entries are then included using Mongo's `$densify`. So the result set will be `70, 80, 90`. Mongo's 
`$fill` is then used to stretch data across the filler entries

### Date Series

The dimension value is rendered to the given unit with `$dateTrunc`. If requested with `fill`, missing entries
are inserted with `$densify` and `$fill` to stretch data across the filler entries. Unit values can be
millisecond, second, minute, hour, day, week, month, quarter, year. See
https://www.mongodb.com/docs/manual/reference/operator/aggregation/densify/. If the united is prefaced with
an integer, this becomes the step value, i.e. `5minute` will spread the data across 5 minute intervals. The
fill argument can be `fill`, `locfFill` or `linearFill`. Locf fill is the default method. NOTE: step only
applies to fill. Truncate is only relevant at whole unit values.

A dimension series request will throw an error if the dimension field is not declared in the ontology.
Unless the field has a projection script, it will be automatically projected into a brief string
appropriate to the precision.

Examples:
* `_time~hour` rounds time to the beginning of the hour
* `_time~5minute` rounds time to the beginning of each minute
* `_time~5minute.fill` rounds time to the beginning of the minute and pads data to ensure entries for each 5 minute interval
* `_time~5minute.locfFill` same as above. Inserted values are set to "last observed value" of each dimension or metric
* `_time~5minute.linearFill` insert metric values on a linear interpolation scale between last and next 

## Organizer

### Silent Dimensions
Dimensions preceded with a bang (exclamation point, !) will inform the metric math and dimension qualifiers but will be
removed prior to formatting the results. For example, `/table/!user:1234,date,location/_count` will return a table
with the number of times the event occurs on 'date', at 'location', but only for user 1234. This is identical to
limiting the results in the query string with `&where={user:1234}`.

## Pull examples
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
