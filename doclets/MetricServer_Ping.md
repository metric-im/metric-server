# Ping
> *syntax*: `PUT|GET /ping/[{format}/]{namespace}[?[attribute=value]]`

| name | description                                                                              |
|---|------------------------------------------------------------------------------------------|
| format | Determines the return type of the request. See Ping Return Formats. Default is 'silent'  |
| namespace | Identifies the event namespace. This governs access and attribute data types. Required.  |
| attribute=value | The query string can include any number of attribute value pairs to be queried with pull |

Using PUT, attributes can be provided through the body rather than query string. This is preferable because
integers and floats can be passed, rather than just strings. Declared attributes will be cast into the specified
data type regardless.

The body of a PUT may be provided as an array, in which case each array entry is treated as an individual event.

if both body and query string are provided, the objects are merged with body taking preference,
`Object.assign({},req.query,req.body)`.

## Ping Return Formats

* *silent* - returns 204 success status with no payload
* *pixel* - returns a 1x1 transparent png
* *script* - returns an empty payload with application/javascript mime type
* *json* - returns the object recorded for the event
* *table* - returns an html table of name value pairs

When there is only one parameter to ping, the parameter is taken as the namespace and the format defaults to silent.

## System Values
`_time`, `_ns` and `_account` are added automatically. If `_time` is provided as an event attribute,
it will override the default.

`_origin` is an optional structure used to provide source context including ip address and user agent string.
_origin can be a javascript object or a string. A string value will be translated with JSON.parse().

| _origin. | description                         |
|----------|-------------------------------------|
| ip       | client ip address                   |
| ua       | user agent string                   |
| tz       | timezone name, i.e. US/Eastern      |
| tzoff    | timezone offset value               |
| lang     | browser language string, i.e. en-us |

If the namespace selects any refiners, each is executed with the base event object and the request
context. This context includes hostname, url, ip and ua (user agent). These values can be provided
explicitly by defining _origin as attribute. It is expected to be an object with one or more of these
context values defined. _context, if present is removed from the event record before being written.

## Ping Examples
`https://metric.im/ping/silent/navigation?site=hello.com&path=/about`

## execute(body,ns)

Ping exports the function `execute`. It expects an object (body) and a namespace (ns). If ns is not
given, it expects body._ns to be defined. Status is return as a JSON object.