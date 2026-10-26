---
title: Stream Processing I — Brokers, Logs and Databases as Streams
part: Part III · Derived Data
chapters:
- 11
---
Batch processing assumed bounded input, and streams never end. This week covers how event streams are transmitted: direct messaging, traditional message brokers with acknowledgments and redelivery, and log-based brokers with partitions and offsets. Then the deep connection between databases and streams: change data capture, log compaction, event sourcing, and the idea that state is just the integral of a stream of changes. You'll build a log broker, CDC into a search index, and an event-sourced reservation system.
