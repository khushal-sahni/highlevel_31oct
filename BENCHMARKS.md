# Benchmarks

Measured 2026-11-01 on this machine with **four worker processes**. Rough numbers from one run. Reproduce with `npm run seed:large`, then API + four workers up, then `npm run bench`.

The 2026-10-31 one-worker run is kept below as the N=1 floor.

## Hardware

| Item | Value |
|---|---|
| OS | macOS (Darwin) |
| CPU | Apple M4, 10 cores |
| Memory | 16 GB |
| Node | v22.22.2 |
| Postgres | 18.6 (Debian, aarch64, Docker) |

The API ran on the host. Four worker containers ran on the same Postgres. `MAX_IN_FLIGHT_CHUNKS=4`. Each worker has one database connection.

## Method

1. `npm run seed:large` — 500,000 opportunities in one workspace (12 uneven stages, ~18 months) and five small workspaces (~3,000 each). Writes `db/benchmark-target.json`.
2. The measured filter is `stageId` + `createdBefore` so the match set is exactly 50,000. A whole large stage would hit the 50,000 cap and fail.
3. Short baseline: list-by-stage in the large workspace and in one small workspace, before any job.
4. `POST /bulk-stage-moves` with that filter. Poll until `completed`. During the run, a loop listed a stage and moved one deal **outside** the filter in the large workspace, and listed a stage in a small workspace. Latencies are those HTTP calls.
5. Second job: the next 50,000-row date slice on the same stage. After at least 1,000 rows were moved, `docker compose kill worker`, then `docker compose up -d --scale worker=4 worker`. Poll until `completed`.
6. SQL proof on the resume job: `moved + skipped = total`; `transitions` for that `job_id` equals `moved`; every moved row is in the target stage.

Throughput is `moved / wall-clock seconds` for that job.

One workspace still applies one chunk transaction at a time (the job row is locked for that chunk). After that commit, another worker can take the next chunk, so the 50ms pauses overlap. That is why N=4 is faster than N=1 on the same 50k job. It is not four parallel applies on one tenant.

## Results (N=4, 2026-11-01)

### Baseline (before the job)

| Call | Time |
|---|---|
| List-by-stage, large workspace | 130 ms |
| List-by-stage, small workspace | 5 ms |

### Bulk move of 50,000

| Metric | Value |
|---|---|
| Wall-clock | 9.0 s |
| Moved | 50,000 |
| Sustained throughput | ~5,600 rows/s |

Job id: `01a1963a-5a21-7b10-864b-a12ae0de0b71`

### Interactive requests during that run

| Where | Samples | p95 | p99 |
|---|---|---|---|
| Same workspace (list + one single move outside the filter) | 416 | 5 ms | 31 ms |
| Different workspace (list-by-stage) | 208 | 3 ms | 6 ms |

### Kill and resume

| Metric | Value |
|---|---|
| Wall-clock (including kill and worker restart) | 9.7 s |
| Moved | 50,000 |
| Skipped | 0 |
| Transitions for the job | 50,000 |
| `moved + skipped = total` | yes (50,000) |
| Transition count equals moved | yes |
| Every moved row in the target stage | yes |

Job id: `01a1963a-7d33-7865-8cfb-1fe0e10db403`

The four workers were killed after 1,000 rows had committed, then started again. Resume is the remaining `pending` item rows. No second transition was written for a row already moved.

## N=1 floor (2026-10-31)

Same machine, same seed shape, one worker container. Kept so the four-worker run has a floor, not a replacement of method.

| Metric | N=1 |
|---|---|
| 50,000-row wall-clock | 21.8 s (~2,300 rows/s) |
| Same-workspace p95 / p99 | 4 ms / 9 ms |
| Other-workspace p95 / p99 | 3 ms / 4 ms |
| Kill and resume | 22.4 s, proof true |

## How to reproduce

```bash
docker compose up --build -d --scale worker=4 postgres worker
DATABASE_URL=postgres://app:app@localhost:5432/opportunities npm run seed:large
# API on the host, same DATABASE_URL
DATABASE_URL=postgres://app:app@localhost:5432/opportunities npm run start:dev
DATABASE_URL=postgres://app:app@localhost:5432/opportunities npm run bench
```

If the API is not on port 3110, set `BENCH_API_URL`.
