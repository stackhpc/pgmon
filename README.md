# Infrastructure Monitoring with Postgres

## Overview

Proof-of-concept as to how Postgres can be used as unified storage for
monitoring data such as time-series metrics and log messages. This repository
contains a fully working demonstration consisting of:

- PostgreSQL
- Grafana
- Minimal HTTP service written in Python ("pgmon-http")
- Grafana data-source plugin (based off Monasca plugin)
- rsyslog for log collection
- collectd for metrics collection

Additionally rsyslog and collectd have been configured to accept network traffic
through their respective mechanisms so if you wish, you can point data from
other hosts at your instance.

More background into this work was presented at FOSDEM PGDay 2017:

http://www.stackhpc.com/stackhpc-at-fosdempgday-2017.html

## Future Work

The work so far has been kept intentionally simple at the cost of performance,
in order to demonstrate how a few tables and triggers can build a very
functional system. However there is some prototyping work we would like to
complete which will have to introduce some complexity, including:

- Background processing of actions currently done in triggers for simplicity
- Partitioning methods of primary tables (logs.messages/metrics.measurements)
- Efficient queuing of ingest data to handle peak loads (e.g. log spew)
- Alerting via metric thresholds and log patterns
- Alerting via active checking using e.g. nagios plugins
- Alerting based on lack of reception of metrics/logs for known hostnames
- Log searching interface and minimal UI
- Log pattern configuration interfaces


## Running

```
vagrant up
```

Then navigate to http://localhost:3000/

You will need vagrant, for Ubuntu-like Linux this should be sufficient:

```
sudo apt-get install vagrant virtualbox
```
