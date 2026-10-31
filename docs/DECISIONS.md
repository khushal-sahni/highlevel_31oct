# DECISIONS.md
> Architectural decisions and why they were made.
> The "why" is what you'll forget. Write it down.

---

## Template

Use this format for each decision:

```
### [Short title]
- **Date**: YYYY-MM-DD
- **Status**: Accepted | Superseded by [link] | Under discussion
- **Context**: What situation forced this decision?
- **Decision**: What did we decide?
- **Consequences**: What does this make easier or harder going forward?
```

---

## Decisions

No product or stack decisions yet. Those belong to the design phase.

### Follow AGENTS.md conventions until design chooses stack and job mechanics
- **Date**: 2026-10-31
- **Status**: Accepted
- **Context**: The repo started from a generic class-based template. The assignment allows NestJS (preferred) or Go, and Mongo or Postgres. Locking a stack or job design before reading the problem would invent answers the brief wants defended later.
- **Decision**: Coding standards and layer rules in `AGENTS.md` are the working convention (classes, layers, workers own the bulk loop, no CRM extras). Language, datastore, chunking, idempotency key, collision rule, snapshot vs live, and isolation mechanism stay undecided until design.
- **Consequences**: Docs and later code share one shape. Design is free to pick NestJS or Go and the stores it can justify. `DESIGN.md` is not drafted in this session.

---

<!-- Add design decisions below as they happen -->
