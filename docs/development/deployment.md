# Deployment Guide

This guide outlines how to deploy the Agent Communication Bus in development and production settings using Docker, Compose, and environment-driven configuration.

## Prerequisites
- Docker ≥ 24 and Docker Compose plugin.
- `.env` file populated with bus, database, and cache credentials.
- Access to container registry (optional for production images).

## Local Development (Docker Compose)

```bash
cp agent-communication-bus/.env.example agent-communication-bus/.env
# Update secrets and paths
docker compose up --build
```

Services defined in `docker-compose.yml`:
- `agent-bus` – Builds from the local Dockerfile, exposes port 8080.
- `postgres` – Stores future persistence data (`postgres:15-alpine`).
- `redis` – Placeholder cache for session/message persistence.

Health checks block the bus until dependencies are ready. Logs stream to the terminal by default.

### Common Overrides
```bash
AGENT_BUS_PORT=9090 docker compose up
POSTGRES_PORT=15432 docker compose up
```

## Production Baseline

Use `docker-compose.prod.yml` pointing to a prebuilt image (`vibes/agent-communication-bus:latest`):

```bash
AGENT_BUS_API_KEY=prod-secret \
POSTGRES_PASSWORD=prod-db-secret \
docker compose -f docker-compose.prod.yml up -d
```

Adjust resource limits under `deploy.resources` to fit your environment. For Kubernetes, translate services into Deployments + Services + ConfigMaps referencing the same environment variables.

## Dockerfile Overview
- Multi-stage build (deps ➜ build ➜ production-deps ➜ runner).
- Based on `node:20-alpine` for minimal footprint.
- Runs as non-root user `nodejs`.
- Healthcheck hits `/health` every 30s.

Customize build arguments:
```bash
docker build --build-arg NODE_VERSION=20-bullseye -t myorg/agent-bus .
```

## Environment Variables

Key variables (set via `.env`, Compose, or cloud secrets):
- `AGENT_BUS_PORT`, `AGENT_BUS_HOST`
- `AGENT_BUS_API_KEY`
- `DATABASE_URL`, `REDIS_URL`
- Adapter-specific toggles (`OPENCODE_ENABLED`, `CODEX_ENABLED`, `CLAUDE_ENABLED`, etc.)

Run `npm run validate:env` before deployment to catch missing values.

## Deployment Steps Summary
1. **Build artifacts** – `npm run build` or Docker image build.
2. **Provision infrastructure** – Database, cache, storage for logs.
3. **Configure secrets** – API keys, database passwords, CLI credentials.
4. **Deploy containers/services** – Compose, Kubernetes, or VM service manager.
5. **Verify health** – Check `/health`, `/metrics`, and adapter logs.
6. **Scale & observe** – Attach logging/metrics (e.g., Prometheus, Loki) and configure alerts.

## Rolling Updates
- Use blue/green or canary strategy: run a new bus container alongside the old one, switch traffic once adapters reconnect.
- Ensure adapters support reconnection (`BaseAdapter` retries automatically).
- Persist message queues externally (future feature) to avoid data loss during restarts.

## Disaster Recovery
- Back up Postgres snapshots and Redis dumps regularly.
- Store `.env`/config secrets in a secure vault (AWS Secrets Manager, HashiCorp Vault).
- Automate restarts via orchestration (Compose restart policies, Kubernetes Deployments).
