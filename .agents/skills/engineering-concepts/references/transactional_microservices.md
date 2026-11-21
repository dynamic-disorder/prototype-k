# Transactional microservices: aggregates, event sourcing, CQRS

**TL;DR** — One transaction changes one aggregate's invariant. Events carry the change to other aggregates and services. Event sourcing makes the event log the state; CQRS projects that log into read models. Both are expensive answers to specific problems, not a default architecture.

## The concept card

| Concept | What it does | Use when | Do not use when | Smallest proof |
| :--- | :--- | :--- | :--- | :--- |
| Aggregate | A consistency boundary; one transaction changes one aggregate | Any domain with invariants that must hold together | The "aggregate" is a table row with no invariant | A transaction cannot span two aggregates |
| Domain event | A fact that something happened, published after the aggregate commits | Other aggregates or services must react | Only the same process reads the data | A subscriber receives it and converges despite duplicates |
| Outbox | Writes the event in the same local transaction as the state; a relay publishes it | You write state and publish an event | There is no broker and no second consumer | No committed state without a published event |
| Event sourcing | Persists the sequence of events; state is a fold over them | Audit, history or replay is a requirement | CRUD with an occasional audit row | Replaying the stream rebuilds the same state |
| CQRS | Separates the write model from one or more read models | Read and write shapes diverge, or search/reporting needs another store | One read model serves every query | A projection lags and then converges |
| Snapshot | Periodic materialization of an aggregate's state, so replay starts there | An aggregate has a long event stream | Streams are short | Snapshot plus later events equals full replay |

## The two problems

**Problem 1: state and event must change atomically.** A service updates its database and publishes an event. If it crashes between the two, the system is inconsistent. A distributed transaction across the database and the broker (2PC) is not a viable option for modern services.

**Problem 2: queries cannot join across services.** Each service owns its data. A query that joins customer and order data is now a call to two APIs, and event sourcing makes it worse because the current state is not a column you can filter.

## Four ways to publish reliably

| Approach | How it works | What it buys | What it costs |
| :--- | :--- | :--- | :--- |
| Publish first, update later | Write the event to the broker; a consumer updates the database | Guarantees the event is published | No read-your-writes; a more complex consistency model |
| Tail the transaction log | Transform row changes into events and publish them | No application change; consistent reads | Low-level events; the business reason is hard to recover |
| Database table as a queue | Insert the event in the same ACID transaction; a poller publishes it | Consistent reads and high-level events | The developer must remember to insert; publishing code can drift from the business logic |
| Event sourcing | The event is the state; saving it is the atomic act | Reliable publishing, audit, history | A different programming model; queries need CQRS |

The outbox is row three, named as a pattern. It is the default when you already have a relational store and a broker.

## Event sourcing

**What it does.** Persists each aggregate as a sequence of events (`Order Created`, `Order Approved`, `Order Shipped`). Current state is a fold over the stream. The event store is a hybrid: a database for `insert` and `load by id`, a message broker for `subscribe`.

**Why it pays.**

- Saving an event is atomic, so publishing is reliable by construction.
- The log is an audit trail, including who made the change.
- Temporal queries: fold up to a point in time to see the state then.
- Mostly avoids the object/relational impedance mismatch, because events are simple and serializable.

**What it costs.**

- A different and unfamiliar model; an existing application's business logic must be rewritten.
- At-least-once delivery: handlers must be idempotent, or deduplicate by a monotonic event id.
- Event schemas evolve forever; loaders must fold multiple versions or upcast to the latest.
- Querying is hard; that is what CQRS is for.
- Snapshots add a second representation and a refresh policy.

**When to use it.** History or replay is a real requirement, the domain has natural events, and the team accepts eventual consistency. **When not.** CRUD, small tools, reporting-only systems, or a team that has not run an event-driven system before.

## CQRS

**What it does.** Splits the application into a command side that writes aggregates (often event-sourced) and a query side that serves materialized views, kept current by subscribing to events.

**Why it pays.** A query can use the store that fits it: document or key-value for primary-key lookup, a text engine for search, a graph database for relationships, an RDBMS for reporting. The command side stays focused on invariants.

**What it costs.** Extra services and view stores to build and operate, and lag between the write and the read. A client that writes and immediately reads may see the previous version; the UI must tolerate it or read its own write deliberately.

**When to use it.** Read and write shapes genuinely diverge, or several query types need different stores. **When not.** One read model covers every query; then CQRS is a second model with no consumer.

## Aggregate rules

- One transaction changes one aggregate. Cross-aggregate consistency is eventual, through events.
- The aggregate is the invariant boundary; if two things must be consistent immediately, they belong in one aggregate.
- Keep aggregates small. A large aggregate serializes writers and grows the event stream.
- Reference other aggregates by id, not by object graph.
- A business process that spans several aggregates needs compensation or a process manager. The source covers the aggregate and event mechanics; the process layer is a separate design.

## Applying it here

The owner's repositories are local tools and one assistant. They have an event bus and a latency journal, but those are notifications and measurements, not the source of truth. Do not event-source them.

- If history is needed, an append-only audit table plus the current state table is the cheap correct answer.
- An outbox only matters when there is a broker and a second consumer; until then it is a table nobody reads.
- CQRS only matters when a read model genuinely needs a different store; the knowledge index is a derived read model, which is the useful half of the idea without the ceremony.

## Sources

- *Developing Transactional Microservices Using Aggregates, Event Sourcing and CQRS, Part 2*, Chris Richardson, InfoQ, 2017. The corpus holds the article text; Part 1 is present only as page images and is therefore not separately digested, only as Part 2 summarizes it.
- The aggregate rules are the article's Part 1 summary plus standard domain-driven design practice.
