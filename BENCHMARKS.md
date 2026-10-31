# Benchmarks

Measured 2026-10-31 on this machine. Rough numbers from one run. Reproduce with `npm run seed:large`, then API + worker up, then `npm run bench`.

## Hardware

| Item | Value |
|---|---|
| OS | macOS (Darwin) |
| CPU | Apple M4, 10 cores |
| Memory | 16 GB |
| Node | v22.22.2 |
| Postgres | 18.6 (Debian, aarch64, Docker) |

The API ran on the host. The worker ran in Docker on the same Postgres.

## Method

1. `npm run seed:large` — 500,000 opportunities in one workspace (12 uneven stages, ~18 months) and five small workspaces (~3,000 each). Writes `db/benchmark-target.json`.
2. The measured filter is `stageId` + `createdBefore` so the match set is exactly 50,000. A whole large stage would hit the 50,000 cap and fail.
3. Short baseline: list-by-stage in the large workspace and in one small workspace, before any job.
4. `POST /bulk-stage-moves` with that filter. Poll until `completed`. During the run, a loop listed a stage and moved one deal **outside** the filter in the large workspace, and listed a stage in a small workspace. Latencies are those HTTP calls.
5. Second job: the next 50,000-row date slice on the same stage. After at least 1,000 rows were moved, `docker compose kill worker`, then `docker compose up -d worker`. Poll until `completed`.
6. SQL proof on the resume job: `moved + skipped = total`; `transitions` for that `job_id` equals `moved`; every moved row is in the target stage.

Throughput is `moved / wall-clock seconds` for that job.

## Results

### Baseline (before the job)

| Call | Time |
|---|---|
| List-by-stage, large workspace | 37 ms |
| List-by-stage, small workspace | 4 ms |

### Bulk move of 50,000

| Metric | Value |
|---|---|
| Wall-clock | 21.8 s |
| Moved | 50,000 |
| Sustained throughput | ~2,300 rows/s |

Job id: `01a19142-f8ee-7620-8d65-1c75fcb7aaf7`

### Interactive requests during that run

| Where | Samples | p95 | p99 |
|---|---|---|---|
| Same workspace (list + one single move outside the filter) | 1,096 | 4 ms | 9 ms |
| Different workspace (list-by-stage) | 548 | 3 ms | 4 ms |

### Kill and resume

| Metric | Value |
|---|---|
| Wall-clock (including kill and worker restart) | 22.4 s |
| Moved | 50,000 |
| Skipped | 0 |
| Transitions for the job | 50,000 |
| `moved + skipped = total` | yes (50,000) |
| Transition count equals moved | yes |
| Every moved row in the target stage | yes |

Job id: `01a19143-4df1-7f69-9e09-c9b42e04fa8f`

The worker was killed after 1,000 rows had committed, then started again. Resume is the remaining `pending` item rows. No second transition was written for a row already moved.

## How to reproduce

```bash
docker compose up -d postgres
DATABASE_URL=postgres://app:app@localhost:5432/opportunities npm run seed:large
docker compose up --build -d worker
# API on the host or via compose, same DATABASE_URL
DATABASE_URL=postgres://app:app@localhost:5432/opportunities npm run start:dev
DATABASE_URL=postgres://app:app@localhost:5432/opportunities npm run bench
```

If the API is not on port 3000, set `BENCH_API_URL`.
