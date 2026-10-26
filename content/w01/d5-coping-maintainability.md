---
title: Coping with Load, and Maintainability
kind: lesson
minutes: 80
chapter: 1
objectives:
- Compare scaling up and scaling out (shared-nothing), and elastic vs manual scaling
- Explain why stateful systems are much harder to distribute than stateless ones
- Explain why there is no generic scalable architecture ("magic scaling sauce")
- Describe operability, simplicity (accidental vs essential complexity, abstraction) and evolvability
reading:
- Approaches for coping with load | 15-16
- Maintainability, Operability, Simplicity, Evolvability | 16-20
- Summary | 20-21
complete:
- You can explain accidental complexity with an example from software you know
- You can explain why an architecture for 100k small requests/s looks different from one for 3 huge requests/min
- You answered the quiz
---

:::problem Load went up 10×. Now what?
You've described your load (yesterday's Twitter example) and measured performance with percentiles. Now load grows by an order of magnitude. The book's blunt warning (p. 15): an architecture that's right for one level of load is unlikely to cope with ten times that load. In a fast-growing service you should expect to rethink the architecture at *every order of magnitude* — maybe more often.

And beyond surviving growth, there's a quieter, bigger cost: most of the money spent on software goes not into building it but into **maintaining** it for years afterwards. How do we keep a system easy to run and change?
:::

:::intuition Up, out, and nothing magic
<div class="figure">
<svg class="dg" viewBox="0 0 640 170" role="img" aria-label="Scaling up versus scaling out">
  <text x="140" y="20" text-anchor="middle" font-weight="700">Scale up (vertical)</text>
  <rect class="boxa" x="80" y="40" width="120" height="110" rx="10"/>
  <text x="140" y="92" text-anchor="middle">one big machine</text>
  <text x="140" y="110" text-anchor="middle" class="sub">more CPU / RAM / disk</text>
  <text x="470" y="20" text-anchor="middle" font-weight="700">Scale out (horizontal, shared-nothing)</text>
  <rect class="boxb" x="330" y="70" width="60" height="60" rx="8"/>
  <rect class="boxb" x="400" y="70" width="60" height="60" rx="8"/>
  <rect class="boxb" x="470" y="70" width="60" height="60" rx="8"/>
  <rect class="boxb" x="540" y="70" width="60" height="60" rx="8"/>
  <path class="ln" d="M360 130 v18 H570 v-18 M430 130 v18 M500 130 v18"/>
  <text x="465" y="165" text-anchor="middle" class="sub">machines coordinate over the network</text>
</svg>
</div>

- **Scaling up** (vertical): move to a more powerful machine. Simple — one machine is easy to reason about — but high-end machines get very expensive, and there's a ceiling.
- **Scaling out** (horizontal): spread the load over several smaller machines. Also called a **shared-nothing** architecture. Necessary for very intensive workloads, but adds complexity.

Real architectures mix both: several fairly powerful machines can be simpler and cheaper than lots of small virtual machines (p. 15).

**Elastic** systems add resources automatically when load rises; others are scaled manually by a human. Elastic is useful when load is unpredictable; manual is simpler and has fewer operational surprises.
:::

:::details Stateless is easy, stateful is hard
Distributing **stateless** services (e.g. web servers that keep no data between requests) across machines is fairly straightforward: put a load balancer in front and add copies. Taking a **stateful** data system from one node to many is much harder — data has to be split, copied, and kept consistent. So the common wisdom (as of 2016) was: keep the database on a single node (scale up) until cost or high-availability needs force you to distribute it (p. 16). The book notes this may change as distributed tools improve — and in many cloud setups it has (managed distributed databases are common today).

**There is no magic scaling sauce.** Scalable architectures are highly specific to their application. The bottleneck might be reads, writes, data volume, data complexity, response-time requirements, or access patterns — usually a mix. A system for 100,000 requests/sec of 1 kB each looks very different from one for 3 requests/minute of 2 GB each, *even though both move the same amount of data per second*.

An architecture that scales well is built around **assumptions** about which operations are common and which are rare — the load parameters. If those assumptions are wrong, the scaling effort is wasted or even harmful. For an early-stage product, being able to iterate quickly on features usually matters more than scaling to a hypothetical future load.

Still, scalable architectures are built from general-purpose building blocks arranged in familiar patterns — and that's what the rest of the book teaches.

## Maintainability (pp. 16–20)

Ongoing costs dominate: fixing bugs, keeping systems running, investigating failures, adapting to new platforms and use cases, repaying technical debt, adding features. We want to avoid creating "legacy systems" ourselves. Three design principles:

### 1. Operability — make life easy for operations
"Good operations can often work around the limitations of bad software, but good software cannot run reliably with bad operations." Ops teams monitor health and restore service, track down causes of problems, apply patches, watch how systems affect each other, plan capacity, manage deployment and configuration, perform migrations, keep things secure, and preserve organisational knowledge.

Data systems help by providing: good **monitoring** (visibility into runtime behaviour); support for **automation**; **no dependency on individual machines** (so one can be taken down for maintenance); good **documentation** and an understandable operational model ("if I do X, Y will happen"); sensible **defaults** that admins can override; **self-healing** where appropriate, with manual control when needed; and **predictable behaviour**.

### 2. Simplicity — manage complexity
Large projects tend to become a "big ball of mud": explosion of the state space, tight coupling, tangled dependencies, inconsistent naming, performance hacks, special cases. Complexity makes changes risky because hidden assumptions and unexpected interactions get overlooked.

Simplicity doesn't mean fewer features. It means removing **accidental complexity**: complexity that is not inherent in the problem as users see it, but arises only from the implementation (Moseley and Marks' definition). The best tool against it is **abstraction**: a clean façade hiding a lot of detail, reusable across many applications. High-level languages hide machine code and registers; **SQL hides on-disk data structures, concurrent clients, and inconsistencies after crashes**. Finding good abstractions in distributed systems is hard — much of this book is a search for them.

### 3. Evolvability — make change easy
Requirements always change: new facts, new use cases, shifting priorities, new platforms, regulation, growth. Agile practices (TDD, refactoring) help at the scale of a few source files; the book looks for agility at the level of a whole **data system** and calls it **evolvability**. Example question to keep in mind: how would you "refactor" Twitter's timelines from approach 1 to approach 2? Simple, well-abstracted systems are easier to evolve.

### Chapter summary
Functional requirements say what a system should do; non-functional ones are properties like reliability, scalability and maintainability. **Reliability**: work correctly despite hardware, software and human faults. **Scalability**: strategies to keep performance good as load grows — which first needs load and performance described quantitatively. **Maintainability**: make life better for the people who run and change the system, through good abstractions and good operability.
:::

:::quiz
### mcq
Two systems both move 100 MB of data per second. System A handles 100,000 requests/s of 1 kB each; system B handles 3 requests/minute of 2 GB each. What does the book conclude?
- [ ] They can use the same architecture since throughput is equal
- [x] Their architectures will look very different, because scalability depends on the specific load parameters, not just data volume
- [ ] System B is easier to scale because it has fewer requests
- [ ] System A must use scale-up and System B must use scale-out
>>>
There is no one-size-fits-all architecture. Per-request overhead, latency requirements, memory use and failure handling differ enormously between millions of tiny requests and a few huge ones, even at the same bytes per second (p. 16). (The numbers are approximate — the book says "the same data throughput".)

### mcq
Why was it traditionally advised to keep a database on a single node for as long as possible?
- [ ] Databases cannot run on more than one machine
- [ ] Single machines never fail
- [x] Distributing a stateful system adds a lot of complexity, whereas stateless services are easy to spread across machines
- [ ] Network bandwidth is more expensive than disk space
>>>
Stateful data must be split, copied and kept consistent across machines, which brings all the problems of Part II of this book. Stateless services can simply be duplicated behind a load balancer. So scale up until cost or availability needs force you to scale out.

### mcq
Which is the best example of **accidental** complexity?
- [ ] A tax application has hundreds of rules because tax law has hundreds of rules
- [x] A service needs three manual steps in a specific order to deploy, because of how its config files happen to be structured
- [ ] A chess engine must evaluate many possible moves
- [ ] A bank must keep balances correct under concurrent transfers
>>>
Accidental complexity is not inherent in the problem users see; it comes from the implementation. Tax rules, chess search and correct balances are *essential* complexity — the problem itself demands them. A fragile, order-dependent deploy process is an artefact of implementation choices.

### tradeoff
Your startup has 500 users and is growing slowly. An engineer proposes rebuilding the backend as 20 microservices on an auto-scaling cluster "so we can scale to millions". What does the book's reasoning suggest?
- [ ] Do it now; scaling later is always harder
- [x] Probably not yet: at an early stage, iterating on features matters more than scaling for hypothetical load, and the design would be built on load assumptions you can't verify yet
- [ ] Do it, but only with manual scaling
- [ ] Never use more than one machine
>>>
The book: an architecture scales well only if built around the *right* assumptions about load; wrong assumptions make the effort wasted or counter-productive. In an unproven product, the ability to iterate quickly usually matters more. (This is the "premature optimisation" point from the book's preface too.)

### explain
The book says SQL is an abstraction that hides a lot. Name three things SQL hides from you, and why that reduces complexity for an application developer.
>>>
SQL hides (1) the on-disk and in-memory data structures (indexes, pages, files), (2) concurrent requests from other clients (the database handles isolation), and (3) inconsistencies after crashes (the database recovers to a consistent state). The application developer can describe *what* data they want and rely on the database to handle storage layout, concurrency and crash recovery correctly — complexity is handled once, well, in a reusable component instead of in every application.

### short
List four things a data system can do to have good **operability**.
>>>
Any four of: good monitoring/visibility into internals; support for automation and standard tools; no dependency on individual machines (machines can be taken down without downtime); good documentation and a clear operational model ("if I do X, Y happens"); good defaults that can be overridden; self-healing with manual override; predictable behaviour with few surprises.
:::

:::connect Where this goes next
"Scale out" is Part II of the book: Chapter 5 copies data to several machines (replication), Chapter 6 splits it across machines (partitioning), and Chapters 7–9 deal with the correctness problems that follow. "Abstraction" is the thread to watch: transactions (Chapter 7) and consensus (Chapter 9) are the big abstractions that hide faults from applications. And evolvability returns in Chapter 4 (changing data formats without downtime) and Part III (rebuilding derived views). Tomorrow is a review day.
:::
