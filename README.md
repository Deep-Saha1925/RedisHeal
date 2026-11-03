# RedisHeal

RedisHeal is a learning-focused JavaScript/Node.js project exploring self-healing systems for Redis-like services. The goal is to understand monitoring, failure detection, recovery policies, and verification by implementing each component incrementally rather than generating the whole application at once.

> **Status:** Early development. The initial Docker-based Redis setup and one-shot TCP health check have been explored. Continuous monitoring is being developed and should be tested locally before being described as complete.

## Project goals

- Monitor a real Redis server running in Docker.
- Measure health-check response time and detect connection failures.
- Distinguish temporary failures from sustained outages.
- Use explicit health states and consecutive success/failure thresholds.
- Add safe, bounded recovery with cooldowns and post-recovery verification.
- Build a separate miniature Redis-like server in Node.js.
- Eventually run the controller against MiniRedis and test failure scenarios.

## Planned architecture

```text
RedisHeal controller (Node.js process)
  ├── Health checker (TCP / Redis PING)
  ├── Failure detector (thresholds and state machine)
  ├── Recovery policy (bounded attempts and cooldown)
  ├── Recovery verifier
  └── Structured incident logs
            |
            v
    Redis in Docker (initial target)

Later:
MiniRedis (separate Node.js TCP server)
  ├── TCP connections
  ├── RESP protocol subset
  ├── In-memory key-value storage
  ├── Commands (PING, GET, SET, ...)
  └── Persistence experiments
```

The controller must run independently from the service it supervises so it can observe a process or container failure.

## Prerequisites

- Node.js (modern LTS version recommended)
- npm
- Docker Desktop
- PowerShell on Windows

## Run Redis locally with Docker

Create a disposable development container:

```powershell
docker run -d --name redisheal-redis -p 6379:6379 redis:7
```

Verify that it is running and responds:

```powershell
docker ps
docker exec redisheal-redis redis-cli PING
```

Expected response:

```text
PONG
```

If the container already exists, inspect it rather than creating another one:

```powershell
docker ps -a
docker start redisheal-redis
```

Stop and start the development container for manual failure experiments:

```powershell
docker stop redisheal-redis
docker start redisheal-redis
```

Do not run these commands against a production Redis service. The development container uses a published host port and is intended for local experiments only.

## Node.js project setup

From PowerShell:

```powershell
cd D:\RedisHeal
npm init -y
npm pkg set type=module
```

The `type: module` setting enables ES module syntax (`import` / `export`) in `.js` files.

## Current learning files

```text
RedisHeal/
├── package.json
├── health-check.js   # One-shot TCP health check (learning exercise)
├── monitor.js        # Continuous monitor (in progress; test before use)
└── README.md
```

The exact files present in your local working tree may differ as implementation progresses.

## Development roadmap

- [x] Create project and configure Node.js ES modules.
- [x] Run Redis 7 in Docker and verify `PING` returns `PONG`.
- [x] Explore a one-shot TCP health check using Node.js `node:net`.
- [ ] Implement and test continuous health checks.
- [ ] Prevent overlapping checks and handle graceful shutdown.
- [ ] Add explicit state transitions and reliable threshold logic.
- [ ] Add structured logs and latency measurements.
- [ ] Implement safe recovery with limits, cooldowns, and verification.
- [ ] Write automated tests for healthy, unavailable, and recovering states.
- [ ] Build a miniature Redis-like TCP server.
- [ ] Implement a small RESP subset and basic key-value commands.
- [ ] Explore persistence and server lifecycle management.
- [ ] Integrate RedisHeal with MiniRedis and run failure experiments.

## Engineering principles

1. Detect before attempting recovery.
2. A single failed health check does not necessarily mean a service is dead.
3. Each check should contribute at most one result.
4. Health recovery must be verified, not assumed.
5. Recovery attempts must be bounded to avoid restart loops.
6. Keep the controller independent from the monitored service.
7. Test failure cases in a disposable local environment.
8. Document what is implemented and tested; distinguish it from planned work.

## Learning approach

This project is being built incrementally. Each milestone should include a concept explanation, a small implementation task, an experiment, code review, and an update to this README. Avoid introducing dependencies or infrastructure until they solve a demonstrated problem.

## License

No license has been selected yet.
