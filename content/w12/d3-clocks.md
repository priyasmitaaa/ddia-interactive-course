---
title: Unreliable Clocks — Monotonic vs Time-of-Day, Drift and NTP
kind: lesson
minutes: 85
chapter: 8
objectives:
- Distinguish durations from points in time, and explain why message timing makes ordering hard
- Explain the difference between time-of-day clocks and monotonic clocks and when to use each
- Explain slewing vs stepping, and why time-of-day clocks are unsuitable for measuring elapsed time
- List the ways clock synchronization goes wrong, including drift, NTP failures, leap seconds, VMs and untrusted devices
- Explain what it takes to get very accurate clocks (MiFID II, GPS, PTP)
reading:
- Unreliable clocks | 278-279
- Monotonic vs time-of-day clocks | 279-281
- Clock synchronization and accuracy | 281-282
complete:
- You calculated the drift for several resync intervals and measured a duration across a clock step in the visualization
- You ran Part A of Exercise 29 on your own machine
- You answered the quiz
---

:::problem Every machine has its own idea of the time
Applications use clocks all the time (pp. 278–279):
- Has this request timed out?
- What's the 99th-percentile response time?
- How many queries per second did we handle over the last five minutes?
- When should the reminder email go out?
- When does this cache entry expire?
- What's the timestamp on this log line?

The first three measure **durations**. The last three describe **points in time**.

In a distributed system this is tricky. Messages take a variable, unknown amount of time, so a message always arrives *after* it was sent, but we don't know how much later. And every machine has its own clock, usually a **quartz crystal oscillator**, that runs a little fast or a little slow. Synchronization helps: the **Network Time Protocol (NTP)** adjusts clocks to time reported by servers, which in turn get it from GPS receivers and other accurate sources. But synchronization is only approximate (p. 279).
:::

:::intuition Two different clocks for two different jobs
**Time-of-day clocks** (pp. 279–280) return the current date and time, also called wall-clock time. Examples are `clock_gettime(CLOCK_REALTIME)` on Linux and `System.currentTimeMillis()` in Java. They count seconds since the epoch (midnight UTC, 1 January 1970) **not counting leap seconds**.
- They're usually synchronized with NTP, so a timestamp from one machine ideally means the same as one from another.
- If the local clock is too far ahead of the NTP server, it may be **forcibly reset and jump backwards**. These jumps, and the fact that leap seconds are often ignored, make time-of-day clocks **unsuitable for measuring elapsed time**.
- Their resolution can be coarse. Older Windows systems moved in steps of 10 ms.

**Monotonic clocks** (pp. 280–281) are for **durations**, such as timeouts and response times. Examples are `clock_gettime(CLOCK_MONOTONIC)` and Java's `System.nanoTime()`. They are guaranteed to **always move forward**.
- Their **absolute value is meaningless**. It might be nanoseconds since boot. Comparing monotonic readings from two different computers makes no sense.
- On multi-socket machines each CPU may have its own timer. The OS tries to present a monotonic view, but take that "with a pinch of salt".
- NTP may **slew** a monotonic clock: speed it up or slow it down by up to **0.05%** if the local quartz is fast or slow. NTP **cannot make it jump**.
- The resolution is good, usually microseconds or better.

**Rule of thumb:** measure timeouts and durations with the monotonic clock. That needs no synchronization between nodes and isn't sensitive to slight inaccuracy (p. 281).
:::

:::visual ClockSkewLWW | Drift, NTP, and measuring durations
@props {"initialTab":"drift"}
**Try this:**
1. Set the drift to **200 ppm** (Google's assumption) and the resync interval to **30 s**, then **1 day**. Check the book's numbers: 6 ms and about 17 seconds (p. 281).
2. At the bottom, measure a 10-second operation that straddles a correction after a day without sync, using a **stepped** clock. The elapsed time comes out *negative*.
3. Switch to **slew**. The measurement is off only by the tiny drift.
:::

:::details How clock synchronization goes wrong (pp. 281–282)
Monotonic clocks don't need synchronization. Time-of-day clocks do, and "hardware clocks and NTP can be fickle beasts":
- **Quartz drift.** Quartz runs fast or slow depending on temperature. Google assumes **200 ppm** for its servers: 6 ms of drift if resynced every 30 s, 17 seconds if resynced once a day. This limits the best accuracy you can get even when everything works.
- **Forcible reset.** If the clock differs too much from the NTP server, the client may refuse to sync, or the clock is reset. Applications then see time jump backwards or forwards.
- **Firewalled from NTP.** A node accidentally cut off from NTP can go unnoticed for some time, and anecdotally this does happen.
- **Network delay limits NTP.** Over the internet, one experiment achieved a minimum error of **35 ms**, with occasional spikes to around **a second**. Large delays can make the client give up entirely.
- **Wrong NTP servers.** Some servers report times off by **hours**. Clients query several servers and ignore outliers, but "it's somewhat worrying to bet the correctness of your systems on the time that you were told by a stranger on the internet."
- **Leap seconds** make a minute 59 or 61 seconds long, and they have crashed many large systems. One remedy is **smearing**: NTP servers "lie" and apply the leap second gradually over a day.
- **Virtual machines.** The hardware clock is virtualized. When a VM is paused for tens of milliseconds while another VM runs, its clock appears to **jump forward**.
- **Devices you don't control** (mobile, embedded). Users deliberately set wrong times, for example to get around game timing limits, so the clock might be wildly in the past or future.

**Very accurate clocks are possible if you pay for them** (p. 282). The draft MiFID II European regulation requires high-frequency trading funds to keep clocks within **100 µs of UTC**, to help debug "flash crashes" and detect market manipulation. That's achievable with GPS receivers, the **Precision Time Protocol (PTP)** and careful deployment and monitoring, but it takes significant effort and expertise. A misconfigured NTP daemon or a firewall blocking NTP lets drift error grow large quickly.
:::

:::practice 29-clocks-lww | Clocks on your machine (Part A today, Part B tomorrow)
Run Part A now to see which of your clocks are adjustable and monotonic. You'll implement Part B (LWW with skewed clocks) tomorrow.
:::

:::quiz
### mcq
You're implementing a request timeout. Which clock should you use?
- [ ] The time-of-day clock, because it's synchronized with NTP
- [x] The monotonic clock: it never jumps backwards, and a duration doesn't need agreement with other nodes
- [ ] Either; they behave the same
- [ ] A GPS clock
>>>
A time-of-day clock can be stepped by NTP and may jump, which makes elapsed-time measurements wrong or even negative. Monotonic clocks are meant for durations (pp. 280–281).

### mcq
Why does it make no sense to compare monotonic clock values from two different machines?
- [ ] Because monotonic clocks drift too much
- [x] Because their absolute value is arbitrary (e.g. nanoseconds since boot), so values from different machines don't mean the same thing
- [ ] Because NTP adjusts them differently
- [ ] Because they have different resolutions
>>>
Only differences between two readings on the same machine are meaningful (p. 280).

### predict
A server's quartz drifts at 200 ppm and its NTP client is firewalled off for a week. Roughly how far off could its clock be?
- [ ] About 6 ms
- [ ] About 17 seconds
- [x] About two minutes (200 × 10⁻⁶ × 604,800 s ≈ 121 s)
- [ ] Exactly zero, because quartz is stable
>>>
The book gives 17 seconds for one day at 200 ppm (p. 281), and seven days is about seven times that. A misconfiguration like this can go unnoticed for some time.

### mcq
What does NTP do to a monotonic clock when the local quartz runs fast?
- [ ] Steps it backwards
- [ ] Nothing: monotonic clocks are never adjusted
- [x] Slews it: slightly slows its rate (by up to 0.05%) without making it jump
- [ ] Resets it to zero
>>>
Slewing adjusts the frequency. NTP cannot cause the monotonic clock to jump forwards or backwards (p. 280).

### tradeoff
How can a leap second be handled with the least risk, according to the book?
- [x] "Smearing": NTP servers spread the leap-second adjustment gradually over a day, so clients never see a 61-second minute
- [ ] Rebooting every server at midnight UTC
- [ ] Turning NTP off for that day
- [ ] Setting all clocks to local time
>>>
Leap seconds have crashed many large systems. Making NTP servers "lie" by smearing the adjustment avoids those assumptions breaking (pp. 281–282).

### explain
A mobile game grants a daily reward if "24 hours have passed since the last claim" according to the phone's clock. Explain the problem and a better design.
>>>
The phone's time-of-day clock is a device you don't control. Users can set it to any date to get around timing limits (p. 282), so the check is trivially cheated. It can also jump with NTP corrections or time-zone and manual changes. A better design trusts a clock you control: the server records the claim time with its own (NTP-synchronized, monitored) clock and decides whether a day has passed. A monotonic clock on the phone could measure elapsed time while the app runs, but it resets on reboot and can't be compared across sessions or devices, so for anything valuable the authoritative check belongs on the server.
:::

:::connect Where this goes next
Clocks are pretty accurate *most* of the time, and that's the danger. Tomorrow: what happens when software relies on synchronized clocks to order events. A 3 ms skew silently drops writes. Then the idea that fixes part of it: a clock reading is a range, not a point.
:::
