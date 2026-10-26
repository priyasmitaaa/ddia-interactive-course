---
title: Graph-Like Data Models — Cypher, SPARQL, Datalog
kind: lesson
minutes: 110
chapter: 2
objectives:
- Model data as a property graph (vertices, edges, labels, properties) and explain its flexibility
- Read a Cypher pattern and explain variable-length traversal (WITHIN*0..)
- Explain why graph queries are awkward in SQL (recursive CTEs)
- Describe triple-stores/RDF, SPARQL, and how Datalog builds queries from rules
- Explain why graph databases are not CODASYL reborn
reading:
- Graph-like Data Models and Property graphs | 48-51
- The Cypher query language and Graph queries in SQL | 51-55
- Triple-stores, the semantic web, RDF and SPARQL | 55-59
- The foundation — Datalog | 59-62
- Summary | 62-63
complete:
- You can write (on paper) a Cypher pattern for "people who live in a city within France"
- You ran the recursive SQL query and your Datalog engine in the exercise
- You answered the quiz
---

:::problem When everything connects to everything
Documents are great when data is a tree. Relational handles simple many-to-many relationships. But some data is mostly *relationships*: who knows whom (social graphs), which page links to which (the web), which road connects which junctions. Facebook keeps one graph with people, places, events, check-ins and comments as vertices, and friendship, attendance and "commented on" as edges (p. 48).

Questions on such data are about **paths**: "find people born somewhere in the US who now live somewhere in Europe". "Somewhere" might be a city, inside a county, inside a state, inside a country — the number of hops isn't known in advance. How do you model and query that?
:::

:::intuition Vertices and edges
A graph has **vertices** (nodes, entities) and **edges** (relationships, arcs). The book's running example (Figure 2-5): Lucy, born in Idaho, and Alain, born in Beaune, France; married; both living in London. Locations form a hierarchy: London → England → United Kingdom → Europe; Beaune → Côte-d'Or → Burgundy → France → Europe; Idaho → United States → North America.

In the **property graph** model (Neo4j, Titan, InfiniteGraph):

- each **vertex** has a unique id, sets of outgoing and incoming edges, and properties (key-value pairs);
- each **edge** has a unique id, a **tail** vertex (where it starts), a **head** vertex (where it ends), a **label** describing the relationship, and properties.

You can store this in two relational tables (Example 2-2): `vertices(vertex_id, properties json)` and `edges(edge_id, tail_vertex, head_vertex, label, properties)`, with indexes on both `tail_vertex` and `head_vertex` so you can traverse forwards and backwards.

Three properties make it flexible (p. 50): **any vertex can connect to any other** (no schema restriction); you can efficiently find **incoming and outgoing** edges to traverse in both directions; and different **labels** let one graph store many kinds of information cleanly. Figure 2-5 shows things hard to express in a fixed relational schema: France has *départements* and *régions* while the US has states; a country within a country (England in the UK); varying granularity (Lucy's birthplace is a state, her residence a city). Graphs are **good for evolvability**: add allergen vertices and "contains" edges, and you can ask what each person may safely eat.
:::

:::visual GraphQuery | Who emigrated from the US to Europe?
**Try this:**
1. Run the query with **Start from the two locations**: from "United States" follow incoming WITHIN edges to collect every place inside it, likewise for Europe, then find people with BORN_IN / LIVES_IN edges into those sets.
2. Switch to **Start from every person** and run again: same answer, different vertices visited. A declarative query lets the optimizer choose.
3. Tick **add Sam**: his BORN_IN edge points straight at the country. The query still works because WITHIN may be followed *zero* or more times.
:::

:::details Querying graphs
### Cypher (pp. 51–52)
Neo4j's declarative language (named after a character in *The Matrix*). Creating data uses arrows: `(Idaho) -[:WITHIN]-> (USA)`. The query (Example 2-4):

```
MATCH
  (person) -[:BORN_IN]->  () -[:WITHIN*0..]-> (us:Location {name:'United States'}),
  (person) -[:LIVES_IN]-> () -[:WITHIN*0..]-> (eu:Location {name:'Europe'})
RETURN person.name
```

`:WITHIN*0..` means "follow a WITHIN edge zero or more times" — like `*` in a regular expression. As with SQL, you don't say how to execute it; the optimizer may scan people forwards or start from the two locations backwards (as in the visual).

### Graph queries in SQL (pp. 52–54)
Possible, but awkward: in relational queries you normally know the joins in advance; in graph queries the **number of joins isn't fixed**. Since SQL:1999, **recursive common table expressions** (`WITH RECURSIVE`) can express variable-length traversal (Example 2-5): build `in_usa` by starting with the "United States" vertex and repeatedly adding vertices with a `within` edge into the set; same for `in_europe`; then people with `born_in` into `in_usa` and `lives_in` into `in_europe`; join. **4 lines of Cypher vs 29 lines of SQL** — different data models suit different use cases.

**Graph databases vs CODASYL** (sidebar p. 54): no schema restricting which record can nest in which; direct access to any vertex by ID or property index, not just via access paths; no maintained ordering of edges; declarative query languages available instead of only imperative navigation.

### Triple-stores and SPARQL (pp. 55–59)
Mostly the same as property graphs in different words. All information is **(subject, predicate, object)**, e.g. *(Jim, likes, bananas)*. The subject is a vertex; the object is either a **primitive value** — then predicate+object is a property: *(lucy, age, 33)* — or **another vertex** — then the predicate is an edge: *(lucy, marriedTo, alain)*. Written in **Turtle** (a subset of N3):

```
_:lucy  a :Person; :name "Lucy"; :bornIn _:idaho.
_:idaho a :Location; :name "Idaho"; :type "state"; :within _:usa.
```

The **semantic web** idea: websites publish machine-readable data via **RDF** so data from many sites can combine into a "web of data". It was over-hyped and hasn't been realised in practice, but triples can be a good *internal* data model regardless (Datomic is a triple-store unrelated to the semantic web). RDF uses URIs for predicates (e.g. `<http://my-company.com/namespace#within>`) to avoid naming conflicts when combining data.

**SPARQL** ("sparkle") predates Cypher, which borrowed its pattern matching. The same query, even more concise:

```
SELECT ?personName WHERE {
  ?person :name ?personName.
  ?person :bornIn  / :within* / :name "United States".
  ?person :livesIn / :within* / :name "Europe".
}
```

### Datalog — the foundation (pp. 59–62)
Studied in the 1980s; the basis later languages build on; used by Datomic and Cascalog (on Hadoop). Facts are written `predicate(subject, object)`: `within(idaho, usa).`, `name(usa, 'United States').`. Queries are built from **rules** that derive new predicates:

```
within_recursive(Location, Name) :- name(Location, Name).                     /* Rule 1 */
within_recursive(Location, Name) :- within(Location, Via),                    /* Rule 2 */
                                    within_recursive(Via, Name).
migrated(Name, BornIn, LivingIn) :- name(Person, Name),                       /* Rule 3 */
    born_in(Person, BornLoc), within_recursive(BornLoc, BornIn),
    lives_in(Person, LivingLoc), within_recursive(LivingLoc, LivingIn).
?- migrated(Who, 'United States', 'Europe').      /* Who = 'Lucy'. */
```

Uppercase words are variables. A rule applies when all predicates on the right of `:-` match; then it's as if the left side were added to the database. Applying rules 1 and 2 repeatedly climbs the hierarchy (Figure 2-6): `within_recursive(namerica, 'North America')`, then `(usa, 'North America')`, then `(idaho, 'North America')`… Rules combine and are reused — less convenient for one-off queries, but powerful for complex data.

### Chapter summary (pp. 62–63)
Historically: one big tree (hierarchical) → bad for many-to-many → relational model. Then NoSQL went two ways: **document** databases (self-contained documents, rare relationships) and **graph** databases (anything may relate to everything). All three are widely used; one can emulate another, but awkwardly. Documents and graphs usually don't enforce schemas. Other models exist too: genome sequence-similarity search (GenBank), particle physics at hundreds of petabytes, full-text search.
:::

:::practice 07-graph-queries | Recursive SQL and a 30-line Datalog engine
Run Example 2-5 against SQLite, then implement bottom-up Datalog evaluation and watch it reach a fixed point iteration by iteration. This is the longest exercise of the week (≈50 min); if time is short, do Task 1 today and Task 2 on the review day.
:::

:::quiz
### mcq
In Cypher, what does `-[:WITHIN*0..]->` mean?
- [ ] Follow exactly one WITHIN edge
- [x] Follow a WITHIN edge zero or more times
- [ ] Follow any edge except WITHIN
- [ ] Follow WITHIN edges backwards only
>>>
It's a variable-length path, like `*` in a regular expression. "Zero" matters: it allows the BORN_IN edge to point directly at the target location (Sam in the visual).

### mcq
Why is this kind of query awkward in plain SQL?
- [ ] SQL cannot store edges
- [x] The number of joins needed isn't known in advance; it depends on how many hops the data requires
- [ ] SQL doesn't support indexes on foreign keys
- [ ] Graph data must be stored as JSON
>>>
Relational queries usually have a fixed set of joins. Variable-length traversal needs recursion (`WITH RECURSIVE`, SQL:1999), which works but is clumsy: 29 lines vs 4 in Cypher.

### mcq
In the triple *(lucy, age, 33)*, what is the predicate–object pair equivalent to in a property graph?
- [ ] An edge from lucy to a vertex called 33
- [x] A property `age: 33` on the vertex lucy
- [ ] A label on an edge
- [ ] A separate table
>>>
When the object is a primitive value, predicate+object behave like a key-value property of the subject vertex. When the object is another vertex, the predicate is an edge label (p. 55).

### mcq
Which is a real difference between graph databases and the CODASYL network model?
- [ ] Graph databases also require navigating access paths from a root record
- [ ] Graph databases restrict which record types can link to which
- [x] Graph databases let you look up any vertex directly by ID or property index, and support declarative query languages
- [ ] CODASYL had no pointers
>>>
CODASYL had schemas restricting nesting, access only via paths, ordered child sets, and imperative queries. Graph databases have none of these restrictions (sidebar, pp. 54–55).

### predict
In a Datalog engine using bottom-up evaluation, the only location facts are `within(beaune, cotedor)`, `within(cotedor, bourgogne)`, `within(bourgogne, france)`, `within(france, europe)` plus a `name` fact for each. When is `within_recursive(beaune, 'Europe')` first derived?
- [ ] In the first iteration
- [ ] It is never derived
- [x] After several iterations — each application of rule 2 climbs one more level up the hierarchy
- [ ] Only if you query for it explicitly
>>>
Rule 1 gives `within_recursive(europe, 'Europe')`; then rule 2 derives France's, then Burgundy's, then Côte-d'Or's, then Beaune's — one hop per iteration, exactly as Figure 2-6 shows for Idaho. Your exercise prints these iterations.

### design
Model this in a property graph and write a Cypher-style pattern for the query: "Find dishes that are safe for Lucy to eat" — given vertices for people, allergens and dishes, with edges ALLERGIC_TO and CONTAINS. (The book suggests this example on p. 51.)
>>>
Vertices: `(:Person {name:'Lucy'})`, `(:Allergen {name:'peanut'})`, `(:Dish {name:'satay'})`. Edges: `(person)-[:ALLERGIC_TO]->(allergen)`, `(dish)-[:CONTAINS]->(allergen)`. Query idea: `MATCH (d:Dish) WHERE NOT EXISTS { MATCH (d)-[:CONTAINS]->(a:Allergen)<-[:ALLERGIC_TO]-(:Person {name:'Lucy'}) } RETURN d.name` — i.e. dishes with no path to an allergen that Lucy is allergic to. (Exact syntax varies by Cypher version; the key idea is a pattern through two edge types with a negation.) If ingredients can contain other ingredients, use `-[:CONTAINS*1..]->` for variable depth.

### explain
Summarise Chapter 2 in four sentences: what are the three main data models, when does each fit, and what's the role of query languages?
>>>
The relational model stores data as tables and handles joins and many-to-one/many-to-many relationships well. The document model stores self-contained trees of one-to-many data with good locality and schema-on-read flexibility, but is awkward for interconnected data. Graph models fit data where anything can relate to anything and queries follow paths of variable length. Each model comes with query languages, and declarative ones (SQL, Cypher, SPARQL, Datalog, aggregation pipelines) win because they hide implementation details, so the database can optimise and parallelise.
:::

:::connect Where this goes next
Graph processing returns in Chapter 10 with **Pregel**-style iterative algorithms (PageRank, shortest paths) over huge graphs, and Datalog's "derive new facts from rules until a fixed point" is an ancestor of incremental view maintenance in Part III. Next week, we go one layer down: how does a database actually store data and find it again? (Chapter 3, the storage engine.)
:::
