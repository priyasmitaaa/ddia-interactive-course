---
title: Project 1, Day 2 — Changing the Format Without Breaking Old Data
kind: project
minutes: 100
objectives:
- Design a self-describing file format with a version header
- Implement backward compatibility: new code reading old segments
- Explain why old code cannot read the new format, and how a fleet would roll it out
reading:
- Re-read data flow through databases and "data outlives code" | 125-127
complete:
- M2 tests pass (and M0, M1 still pass)
- DESIGN.md section 2 (on-disk format) is written
- You answered the quiz
---

:::problem The store is in production. Now add a field.
Product wants "last modified" times: every record should carry a timestamp. Your store already holds data written in the v1 format, and those files must keep working — **data outlives code** (p. 126). You can't stop the world, rewrite every file, and restart; and even if you could, a crash halfway through that migration would leave a mixture of formats anyway.
:::

:::intuition Put the writer's schema at the top of the file
Remember how Avro handles a large file of records: the **writer's schema is included once at the start of the file** (object container files, p. 121). Do the same:

- v2 segments begin with a 4-byte header, `KV2\n`, followed by v2 records (crc, **timestamp**, lengths, key, value).
- v1 segments have no header and use the old record layout.
- When opening a segment, look at the first bytes to choose the parser.

So one store can contain both formats at once. Rules that keep it correct:

1. **New code reads both formats** (backward compatibility). v1 records get timestamp 0 ("unknown") — a default value, exactly like Avro's reader filling in a default for a field the writer didn't write.
2. **Never mix formats inside one file.** If the newest existing segment is v1, close it and start a new v2 segment instead of appending.
3. **Old files become v2 naturally** when compaction rewrites them — the migration happens as a side effect of normal operation, no special downtime.

<div class="figure">
<svg class="dg" viewBox="0 0 640 120" role="img" aria-label="A store mixing v1 and v2 segments">
  <rect class="boxc" x="10" y="30" width="140" height="50" rx="8"/><text x="80" y="52" text-anchor="middle">000001.data</text><text x="80" y="70" text-anchor="middle" class="sub">v1 (no header)</text>
  <rect class="boxc" x="165" y="30" width="140" height="50" rx="8"/><text x="235" y="52" text-anchor="middle">000002.data</text><text x="235" y="70" text-anchor="middle" class="sub">v1 (no header)</text>
  <rect class="boxb" x="320" y="30" width="140" height="50" rx="8"/><text x="390" y="52" text-anchor="middle">000003.data</text><text x="390" y="70" text-anchor="middle" class="sub">KV2 header + v2</text>
  <rect class="boxb" x="475" y="30" width="150" height="50" rx="8"/><text x="550" y="52" text-anchor="middle">000004.data</text><text x="550" y="70" text-anchor="middle" class="sub">active, v2</text>
  <text x="160" y="105" text-anchor="middle" class="sub">written by old code, still readable</text>
  <text x="470" y="105" text-anchor="middle" class="sub">written by new code</text>
</svg>
</div>
:::

:::details What about forward compatibility?
Old (v1) code that opens a store containing v2 segments would misread them: it doesn't know the header and would interpret `KV2\n` plus a timestamp as lengths. Your v1 format had no way to say "skip what you don't understand" — it isn't forward compatible.

In a fleet where several servers share or exchange files (or replicate them — Chapter 5), that means the rollout order matters:

1. Deploy code that can **read** v2 but still **writes** v1, everywhere.
2. Once every node can read v2, flip the switch to **write** v2.

This "read first, write later" two-phase rollout is the standard way to change formats when old readers aren't forward compatible. Better still, design formats so that future versions can be partly read by old code: a header length field, or tagged fields that can be skipped (Protocol Buffers' approach).
:::

:::practice 17-project1-kv | Milestone M2
Implement `encode_v2`, the v1/v2 detection in `scan_segment` (note that the generator must *return* the end offset of good data), the header in `_open_active`, the "don't append to v1" rule in `__init__`, and switch offsets to `V2_HEADER.size`. Run all tests: M0 and M1 must still pass. Then write `DESIGN.md` section 2.
:::

:::quiz
### mcq
Your v2 code opens a store whose only segment is a non-empty v1 file. What should it do before the first write?
- [ ] Rewrite the v1 file in v2 format immediately
- [ ] Append v2 records to the end of the v1 file
- [x] Leave the v1 file as a closed segment and start a new v2 segment
- [ ] Refuse to open the store
>>>
Mixing formats in one file would make it unparseable. Starting a new segment keeps every file self-describing; compaction can rewrite old segments later.

### mcq
Which book idea does the `KV2\n` segment header mirror?
- [ ] Protocol Buffers field tags
- [x] Avro object container files, which include the writer's schema once at the start of the file
- [ ] JSON Schema
- [ ] Thrift CompactProtocol
>>>
A large file of records written with one schema can carry that schema (or here, a version marker) once at the top (p. 121).

### predict
A v1 server (old code) is accidentally pointed at a store containing v2 segments. What is the most likely outcome?
- [ ] It reads everything correctly but ignores timestamps
- [x] It misparses the v2 segments — the format gives old code no way to skip what it doesn't understand, so it isn't forward compatible
- [ ] It upgrades itself
- [ ] It converts the files back to v1
>>>
Forward compatibility has to be designed in. Here it wasn't, so the safe rollout is "deploy v2 readers everywhere first, then start writing v2".

### explain
Why does compaction turn out to be a convenient time to migrate old segments to the new format?
>>>
Compaction already reads closed segments and writes their live records into a brand-new file, so writing that new file in the v2 format costs nothing extra. The migration happens gradually as part of normal background work, with no downtime and no special migration job; old files simply disappear as they're compacted. Until then, the reader handles both formats.
:::

:::connect Where this goes next
In Chapter 5 you'll see the same issue in replication: **statement-based** and **WAL-shipping** replication couple leader and follower to the same storage format, so you often can't run different versions on leader and followers; **logical (row-based) logs** decouple them and allow zero-downtime upgrades. Tomorrow: durability throughput and compaction without stopping the world.
:::
