# Metric Server

Metric Server is a web api for posting and retrieving atomic events. It is intended to
be simple and versatile. It's primary api's are **ping** and **pull**. Ping is used to
record an event, while pull queries recorded events. Both are available through web
endpoints that can exercised directly through the browser url bar.

```http request
https://metric.im/ping/roadtrip?vehicle=sedan&color=blue&make=ford&plate=123GHI&speed=57&reportedBy=johndoe
```
Ping sends reports an event. Attributes are included in the query string or post body. The namespace,
in this case "roadtrip" defines the attributes and automatic embellishments. All events will include
the time stamp and may automatically add location data and lookup the weather at the time.
```http request
https://metric.im/pull/table/roadtrip/date,vehicle,make/speed:avg,_count
```
This pull request gets a table of all vehicles noted by day, type and manufacturer (the dimensions)
and reports the average speed across these dimensions along with the count.

The schema can be totally arbitrary or defined in depth through the namespace ontology for "roadtrip".

* **[Ping](MetricServer_ping)**: Record events

* **[Pull](MetricServer_pull)**: Query events

* **[Ontology](MetricServer_ontology)**: Defining schemas, if needed, including datatypes, derived fields,
rendering formats, external data, etc.

Metric Server is designed to plugin into the lightweight [metric componentry](MetricMessenger)

## Basic Usage

```bash
npm install @metric-im/componentry;
npm install @metric-im/metric-server;
```

```javascript
import Componentry from '@metric-im/componentry';
import MetricServer from '@metric-im/metric-server/index.mjs';
import Profile from './profile.mjs';

const app = express();
const componentry = new Componentry(app,await Profile());
await componentry.init(AccountServer,CommonMixin,DataServer,MetricServer,BridgeServer,WikiMixin,UML,ApplicationModule);
```
