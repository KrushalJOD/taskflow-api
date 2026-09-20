# TaskFlow API

A small Node.js/Express REST API for managing personal tasks, built as the
project for the **SIT223/SIT753 7.3HD "DevOps Pipeline with Jenkins"** task.
It was deliberately kept small but "real": it has authentication, CRUD
business logic, a persistence layer, automated tests, a Dockerised build,
and operational endpoints — enough functional depth to justify all 7
pipeline stages without needing an external database or cloud account.

## Features

- **Auth:** register/login with bcrypt-hashed passwords and JWT access tokens.
- **Tasks:** authenticated CRUD (`create`, `list`, `get`, `update`, `delete`),
  scoped per user.
- **Operational endpoints:** `GET /health` (liveness/readiness) and
  `GET /metrics` (Prometheus-format metrics via `prom-client`).

## Tech stack

| Concern        | Choice                          |
|-----------------|----------------------------------|
| Runtime         | Node.js 18, Express              |
| Auth            | bcryptjs, jsonwebtoken           |
| Tests           | Jest, Supertest, jest-junit      |
| Code quality    | ESLint, SonarQube                |
| Security        | npm audit, Trivy (image scan)    |
| Container       | Docker (multi-stage build)       |
| Deploy/Release  | Docker Compose (staging + prod)  |
| Monitoring      | prom-client, Prometheus, alert rules |
| CI/CD           | Jenkins (declarative pipeline)   |

## Running locally

```bash
npm install
npm test        # runs the Jest + Supertest suite with coverage
npm start        # starts the API on http://localhost:3000
```

Try it:

```bash
curl -X POST localhost:3000/api/auth/register -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"password123"}'

curl -X POST localhost:3000/api/auth/login -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"password123"}'
# -> { "token": "..." }

curl -X POST localhost:3000/api/tasks -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" -d '{"title":"Finish 7.3HD"}'

curl localhost:3000/api/tasks -H "Authorization: Bearer <token>"
curl localhost:3000/health
curl localhost:3000/metrics
```

## Running in Docker

```bash
docker build --build-arg APP_VERSION=local -t taskflow-api:local .
docker run -p 3000:3000 -e JWT_SECRET=change-me taskflow-api:local
```

## The Jenkins pipeline

The `Jenkinsfile` in the repo root implements all 7 required stages:

1. **Build** – `npm ci`, then a multi-stage `docker build` producing a
   versioned image tagged `taskflow-api:build-<BUILD_NUMBER>`.
2. **Test** – `npm test` runs the Jest/Supertest suite; JUnit XML and
   coverage are archived and shown in Jenkins' Test Results trend.
3. **Code Quality** – ESLint (`npm run lint`) plus a SonarQube scan
   (`sonar-scanner`, config in `sonar-project.properties`), gated by a
   `waitForQualityGate` step.
4. **Security** – `npm audit` against dependencies and `trivy image` against
   the built container; the build is aborted if any CRITICAL vulnerability
   is found.
5. **Deploy** – `docker compose -f docker-compose.staging.yml up -d`,
   followed by a polling smoke test against `/health`.
6. **Release** – a manual `input` approval gate, then the image is
   re-tagged with a semantic release tag, an annotated Git tag is pushed,
   and `docker-compose.prod.yml` promotes it to production.
7. **Monitoring** – polls the production `/health` and `/metrics`
   endpoints after release and emails the team (via the Email Extension
   plugin) if the post-release health check fails. `monitoring/prometheus.yml`
   and `monitoring/alert.rules.yml` are provided for a real Prometheus
   instance to scrape both environments continuously.

### Required Jenkins setup (one-time)

- Install plugins: **NodeJS**, **Docker Pipeline**, **SonarQube Scanner**,
  **Email Extension**.
- Manage Jenkins → Tools: add a NodeJS installation named `NodeJS-18`.
- Manage Jenkins → System: configure a SonarQube server named
  `SonarQubeServer` (matches `SONARQUBE_ENV` in the Jenkinsfile) and the
  Extended E-mail Notification SMTP settings.
- Manage Jenkins → Credentials: add a **Secret text** credential with ID
  `taskflow-jwt-secret` used as the app's `JWT_SECRET`.
- The Jenkins agent needs `docker`, `docker compose`, `curl`, and `trivy`
  on its `PATH`.
