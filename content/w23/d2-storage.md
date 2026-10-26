---
title: Milestone 2 — An LSM-Tree with a Write-Ahead Log
kind: project
minutes: 110
objectives:
- Implement the write path: WAL append (fsync), memtable, flush to an SSTable
- Implement the read path: memtable, then SSTables newest-first, using a sparse index
- Implement crash recovery that replays the WAL and truncates a torn tail
reading:
- Re-read hash indexes (append-only log, crash recovery, partial records) | 70-74
- Re-read SSTables and LSM-trees | 74-80
complete:
- The first three M2_Storage tests pass (put/get/delete/flush, crash recovery, sparse index)
- You can explain the order "WAL first, then memtable"
- You answered the quiz
---

:::problem A store that survives crashes
Milestone 2 is the storage engine of a single node, the LSM design from Chapter 3. Writes must be **durable once acknowledged**. Reads must find the newest value, **deletes must stick**, and a crash at any moment must lose nothing that was acknowledged.
:::

:::intuition Write path, read path, recovery
**Write path** (`put`, `delete`):
1. Append a framed record to the **WAL** and `fsync` it. Only now is the write durable.
2. Insert into the **memtable**, an in-memory dict. A delete inserts a **tombstone** (`None`).
3. When the memtable reaches its limit, **flush**: write it **sorted by key** as a new immutable SSTable file, then truncate the WAL, since everything is now in the SSTable.

**Read path** (`get`): look in the memtable, then in the SSTables **from newest to oldest**. The first hit wins, even if it's a tombstone, which means deleted. Each SSTable has a **sparse index** (every 16th key with its byte offset), so a lookup reads only one block of the file: bisect the index, read from that offset to the next indexed offset, and scan.

**Recovery** (`_recover`, run on startup): load the SSTables, then **replay the WAL** into the memtable. If the WAL ends in a torn record, `decode_stream` tells you where the valid data ends, so **truncate** the file there. That record was never acknowledged, because it wasn't fully on disk when the process died.

**Why WAL first?** If you updated the memtable first and crashed before the WAL write, you'd have acknowledged nothing, which is fine. But a reader in between might have seen a value that then vanishes after a crash. Write-ahead means the durable log always contains at least everything the in-memory state contains, the same principle as B-tree WALs and database redo logs (Chapter 3).
:::

:::practice 45-capstone-minikv | M2 — the write path, read path and recovery
Implement `SSTable.get`, `LSMStore._recover`, `put`, `get` and `flush`. Run `test_minikv.py M2_Storage`. The compaction test will still fail until tomorrow.
:::

:::quiz
### mcq
In what order must a write go through MiniKV's storage engine?
- [ ] Memtable, then WAL, then acknowledge
- [x] WAL (fsynced), then memtable, then acknowledge
- [ ] SSTable, then WAL
- [ ] Acknowledge, then WAL
>>>
Write-ahead: the log must durably contain the write before it becomes visible or is acknowledged (Chapter 3).

### predict
Key "k" is put in SSTable 1, deleted (tombstone) in SSTable 3, and absent from the memtable. What does `get("k")` return?
- [ ] The value from SSTable 1
- [x] None, because SSTables are searched newest-first and the tombstone in SSTable 3 is found first
- [ ] An error
- [ ] Both values
>>>
That's why tombstones must survive until a compaction can safely drop them.

### mcq
What does the sparse index buy you?
- [ ] Fewer SSTables
- [x] A lookup reads only one small block of an SSTable instead of scanning the whole file, while keeping only a fraction of the keys in memory
- [ ] Sorted output
- [ ] Crash safety
>>>
SSTables are sorted, so an index with every Nth key bounds where a key can be (Chapter 3).

### explain
Explain what happens, step by step, if MiniKV crashes halfway through writing a WAL record, and why no acknowledged write is lost.
>>>
`put` acknowledges only after the WAL record has been written and fsynced. If the process crashes mid-append, the write was never acknowledged, so the client sees an error or timeout and may retry. On restart, `_recover` reads the WAL and decodes framed records until one is truncated or fails its CRC. All earlier records are complete and are replayed into the memtable, and those are exactly the acknowledged writes not yet in an SSTable. The torn tail is truncated, so later appends don't follow garbage. Data already flushed to SSTables is safe, because SSTables are written to a temporary file, fsynced, and atomically renamed (Chapter 3).
:::

:::connect Tomorrow
Compaction (reclaiming space and dropping tombstones), and a careful look at what your storage engine guarantees.
:::
