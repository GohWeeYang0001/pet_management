# AWS deployment preparation (manual deployment later)

This repository is prepared for deployment; no AWS resources or accounts have
been accessed and nothing has been deployed. Do not run the steps below against
production until infrastructure, access and costs have been reviewed.

## Architecture

- Browser: `https://admin.petgrooming.my` -> CloudFront -> **private S3** frontend.
- Browser API calls: `https://api.petgrooming.my` -> HTTPS Application Load Balancer
  -> Elastic Beanstalk instance nginx -> Node.js/Express.
- Backend -> private RDS PostgreSQL over verified TLS.

These HTTPS subdomains are different origins but the same site. Credentialed
CORS permits the frontend origin, and SameSite=Lax supports this arrangement.
Neither S3 nor CloudFront hosts the backend. PostgreSQL sessions remain in the
database; no sticky sessions or localStorage credentials are introduced.

## Production configuration

Set backend environment properties securely in the later Beanstalk setup. Do
not upload a local `.env`, use secret-bearing shell commands, put secrets in
source control, or put backend secrets in Vite variables. Restrict console/log
access. Prefer a managed secret workflow supported by the selected EB platform.

| Variable | Production value / purpose |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | Application port supplied/configured by EB, matching nginx upstream; local default 3000 |
| `TRUST_PROXY_HOPS` | `2` for ALB -> nginx -> Express; verify actual forwarding chain before launch |
| `FRONTEND_ORIGIN` | `https://admin.petgrooming.my` (exact origin, no trailing slash) |
| `DB_HOST` | Actual RDS PostgreSQL hostname (not a custom alias) |
| `DB_PORT` | `5432`, unless configured otherwise |
| `DB_USER` | Dedicated application database role |
| `DB_PASSWORD` | Private database password |
| `DB_NAME` | Production application database name |
| `DB_SSL` | `true` |
| `DB_SSL_CA_FILE` | Absolute path to the verified, current AWS RDS PEM CA bundle on the backend host |
| `AUTH_SECRET` | Strong randomly generated private secret, at least 32 characters; same across backend instances |

Frontend **build-time**, public configuration: set
`VITE_API_BASE_URL=https://api.petgrooming.my` when running `npm run build`.
Changing this later requires rebuilding/reuploading `dist/`. Never add
`VITE_AUTH_SECRET`, `VITE_DB_PASSWORD`, or any other secret. All services use the
shared API base/helper and requests include credentials. A trailing slash on
the configured API base is normalized.

Locally, retain the existing ignored `.env`, `DB_SSL=false` (or unset), HTTP
development origins, and default port 3000. Frontend's empty API base uses its
Vite `/api` proxy. Explicit `http://localhost:3000` also works. Trust proxy is
always disabled outside production. No real `.env` was changed for this task.

## Backend artifact and startup

Use a supported Node.js LTS version **22 or newer**, aligned between build
machine and the selected EB platform. Check current platform availability at
deployment time; do not select an unsupported runtime.

From `backend`, locally or in a controlled build environment:

```text
npm ci
npm run build
```

Build produces `dist/` for the API and `dist-tools/` for administrative scripts.
`npm start` runs compiled JavaScript (`node dist/server.js`), not the development
watcher. EB's source bundle must have **backend package.json at ZIP root**, plus
package-lock.json, compiled dist/, compiled dist-tools/, and the required CA
bundle at the path specified by `DB_SSL_CA_FILE`. Exclude node_modules, .env,
.git, test fixtures, local database dumps and frontend files. Dist outputs are
ignored by Git but must be deliberately included in the deployment bundle.
No Procfile is required for this npm-start layout. Do not build on the EB host
implicitly: compilation uses dev dependencies and occurs before packaging.

The API honors `PORT` with validated local fallback 3000. Configure the later
EB proxy to use the same port. The source is CommonJS-compatible TypeScript;
compiled output does not require tsx or TypeScript at runtime.

## Reverse proxy, HTTPS and cookies

Production trusts **two hops by default**, not `true`: nearest instance nginx
and then ALB. `TRUST_PROXY_HOPS` accepts 1-5 only in production. This is a
deployment topology assumption, not proof that arbitrary forwarding headers are
safe. Confirm nginx appends the real peer to X-Forwarded-For and preserves the
ALB's HTTPS protocol. Verify actual client IP handling before enabling traffic.
Do not accept variable-length/bypass paths or add another proxy without
reviewing the setting. Restrict instance ingress to the ALB and Node access to
the instance proxy; never expose the application port directly to the Internet.
Ensure forwarded headers cannot be supplied from an untrusted direct path.

Terminate HTTPS using the API domain's certificate at the ALB, redirect public
HTTP to HTTPS there, and preserve `X-Forwarded-Proto`. Trust proxy lets Express
recognize HTTPS and the real client IP behind that chain. Cookie Secure is
explicitly controlled by NODE_ENV, **not** disabled for internal HTTP forwarding.
The cookie remains HttpOnly, Secure in production, SameSite=Lax, Path=/, and
`__Host-pm_session` with **no Domain attribute**; the API host owns it. The
browser must use the HTTPS API hostname, not the EB default hostname. The
frontend must send credentials; JavaScript cannot read the cookie.

Sessions retain 30-day rolling inactivity expiry and an absolute 90-day limit
from login. Cookie Expires matches the database deadline. Logout immediately
revokes the database row. CORS accepts only configured exact origins, includes
credentials, and never uses `*`. CSRF request headers, active-user checks,
password hashing, no-store responses, rate limiting and Helmet remain enabled.

## Database TLS and initialization

`DB_SSL=true` enables node-postgres TLS with `rejectUnauthorized: true`.
`DB_SSL_CA_FILE` supplies the trusted PEM bundle; otherwise Node's default trust
roots are used (which may not trust RDS). The deployment must supply the correct
AWS RDS bundle, verified using official AWS documentation, and keep it current
for certificate rotations. Certificate/hostname verification must not be
disabled to resolve connection errors. Use the actual RDS hostname. Local
PostgreSQL remains non-TLS unless configured. No RDS connection has been tested.

**One recommended fresh-production initialization process:** use the current
schema bootstrap **then migration 001 only**. `database/schema.sql` already
includes the final appointment-status rules (002) and authentication tables
(003), but it does not include expenses/inventory (001).

1. Later, provision a **new empty** production database and a bootstrap role
   through the approved manual infrastructure workflow. Confirm target hostname
   and database are production's empty database, never the local database.
2. From an authorized private-network administrative host, use psql with
   `sslmode=verify-full` and the trusted CA file; use a hidden password prompt or
   protected secret mechanism, not a credential-bearing command/URI.
3. Apply these files in order, stopping on any error (from repository root):

   ```text
   psql -X -W --set=ON_ERROR_STOP=1 --single-transaction --file=database/schema.sql
   psql -X -W --set=ON_ERROR_STOP=1 --file=database/migrations/001_add_expenses_inventory.sql
   ```

   Before these commands, configure PGHOST, PGPORT, PGUSER, PGDATABASE,
   PGSSLMODE=verify-full and PGSSLROOTCERT in the protected administrative
   session. Do not set/print passwords in command history. The schema transaction
   is atomic; migration 001 has its own transaction. If 001 fails, stop and
   investigate; do not rerun the schema over existing tables.
4. **Do not run 002 or 003 after this bootstrap**; their changes are already in
   schema.sql and 003 would duplicate tables. Do not run seed.sql automatically:
   it contains demonstration business data. Verify expected tables and constraints,
   including expense, inventory_item, inventory_transaction, app_user and app_session.
5. Record the schema baseline and migration 001 application manually. Already
   populated/legacy databases require a separate migration-state review; do not
   reuse this fresh-database procedure for them. No applied migrations were edited.

Separate the bootstrap/DDL owner from the runtime role. Grant the runtime role
only needed table CRUD and identity-sequence usage in the app schema; no
superuser, database creation or general DDL rights. Enable RDS encryption,
private networking, backup retention and restore testing during provisioning.

## First production ADMIN

No default account exists. After bootstrap, use the existing hidden-password
workflow from an authorized terminal with private RDS connectivity. Configure
only the intended production DB_* variables, verified TLS and controlled access.
Confirm the target without printing secrets. From a source checkout with dev
dependencies installed, run `npm run create-user` in backend. In the compiled
deployment bundle use `npm run create-user:production` (same workflow, no tsx).
Select ADMIN and choose a strong private password; do not pass it as an argument.
Do not run setup-auth on EB: provision AUTH_SECRET through protected configuration,
not generated instance-local .env files. The CLI creates only the requested
account; remove temporary administrative access afterward.

## Planned deployment order (not executed)

1. Review region, monthly costs, permissions, supported Node/PostgreSQL versions,
   VPC/private subnets/security groups, backups and secret handling.
2. Prepare domain control and HTTPS certificates for frontend and API in the
   appropriate AWS regions (CloudFront viewer certificates in us-east-1).
3. Provision private RDS and controlled administrative access; apply the single
   bootstrap process above and create the first ADMIN.
4. Build/package backend; create the EB Node environment with ALB HTTPS,
   restricted networking and production variables. Set health check path
   `/api/health` with success code 200. Test TLS/database access before DNS cutover.
5. Build frontend with its production API base. Upload only frontend dist/
   contents to private S3; configure CloudFront origin access control (OAC),
   default root index.html, HTTPS redirect and the frontend certificate/domain.
6. After verification/approval, configure domain DNS for API ALB and frontend
   CloudFront. Confirm frontend builds use the public API domain and exact CORS.
7. Validate login, reload, all business pages, logout and cookie flags in a real
   HTTPS browser; review logs/health/alarms and establish rollback procedures.

For SPA routes, serve index.html for application navigations when needed; avoid
caching missing JS/CSS as HTML. Current app uses in-app page navigation. Cache
hashed assets long-term; index.html should have short/no cache and be invalidated
on releases. Do not forward API calls through the static S3 origin. API responses
remain no-store. Keep previous frontend/backend artifacts for rollback; take
database snapshots before future schema changes.

## Checks and remaining deployment considerations

Repository checks: frontend build/lint; backend type checks, build,
test:deployment, test:auth and test:workflow against the **local database only**.
Production-mode local checks validate cookie flags/configuration, not actual AWS
TLS, nginx forwarding, security groups, certificates or RDS connectivity. Never
point development smoke tests at the live production database.

`GET /api/health` is public liveness and returns only `{"status":"ok"}`; it does
not prove database readiness. `/api/test` remains for compatibility. SQL/errors
are not returned to users. Server logs retain operation context and safe error
codes, not SQL messages/detail, stack traces, passwords, bodies or cookies.
Protect logs and monitor database failures separately.

The login limiter is in-memory/per-process and resets on restart. Before scaling
to multiple instances, plan a shared limiter or equivalent reviewed edge
protection; PostgreSQL-backed sessions themselves support multiple instances.
Monitor RDS connection limits as instances scale. The app has no migration
runner; initialization remains an explicit operator step, never automatic startup.
No IaC, deployment commands, AWS CLI access or AWS resources were added/run.

## Official references

- [AWS EB reverse proxy and PORT](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/platforms-linux-extend.proxy.html)
- [AWS EB Express deployment and npm startup](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/create_deploy_nodejs_express.html)
- [Express trust proxy security](https://expressjs.com/en/guide/behind-proxies.html)
- [node-postgres TLS configuration](https://node-postgres.com/features/ssl)
- [RDS PostgreSQL TLS and certificates](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.SSL.html)
