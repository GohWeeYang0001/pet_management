# Local authentication

Authentication uses bcryptjs (cost 12) and revocable PostgreSQL sessions. Login
creates a random 256-bit credential in an HttpOnly cookie. `app_session` stores
only an HMAC-SHA256 of that credential using `AUTH_SECRET`. Every protected request checks expiry and the user's current active
state. Logout deletes the session before clearing the cookie. Credentials are
never returned as JSON or stored in browser localStorage.

## Session lifetime

Sessions expire after **30 days of inactivity**. Each successfully authenticated
API request (including `/api/auth/me` when opening the app) renews the deadline
to 30 days from that request, capped at **90 days from the original login**.
The original `app_session.created_at` never changes during renewal. At the
90-day limit, login is required again regardless of activity. Simply leaving
the app open does not renew a session; there is no background keep-alive.

The persistent cookie uses `Expires` set to the database's exact deadline
(HTTP dates have second precision), without a separately calculated `Max-Age`.
HttpOnly, SameSite=Lax, Path=/, and production Secure/`__Host-` protections are
unchanged. Expired or inactive-user sessions return 401 and clear the cookie.
Renewal is an atomic update of a still-valid session, never an insert, so expired
or logged-out sessions cannot be revived. Logout immediately deletes the session.
There are no permanent/non-expiring sessions. Existing unexpired sessions adopt
the rolling policy on their next authenticated request; expired sessions require
login. No additional database migration is needed.

## Database and configuration

Migration `database/migrations/003_add_app_user.sql` creates `app_user` and
`app_session`, with role checks, case-insensitive unique usernames, a user foreign
key and indexes for user/expiry lookup. It contains no user credentials and does
not change business tables. It has already been applied to this local database.
For another existing database, execute that migration once after 001 and 002.
For a fresh database use `database/schema.sql` and the existing business-table
setup; do not apply 003 twice after bootstrapping its auth tables.

Run backend commands from `C:\htdocs\pet_management\backend`:

```powershell
npm run setup-auth
npm run create-user
```

`setup-auth` generates a cryptographically random local `AUTH_SECRET` in the
ignored `.env` without printing it. It preserves an already configured secret.
It has already been run locally. Do not copy the secret into source files.

`create-user` prompts for username, role (`ADMIN` for the first user), a hidden
password and its confirmation. Use an interactive terminal. Passwords require
at least 12 characters and at most 72 UTF-8 bytes (bcrypt's input limit). Passwords
are not accepted as command arguments and no public user-creation endpoint exists.
Choose your own password; no permanent admin or default password was created.
Run the same command with `EMPLOYEE` to add a colleague later.

Backend variables are documented in `backend/.env.example`:

- Existing `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.
- `AUTH_SECRET`: at least 32 characters; keep it private. Changing it invalidates
  current session credentials.
- `NODE_ENV`: `development` locally; `production` enables Secure cookies with
  the `__Host-` cookie prefix. Production requires HTTPS.
- `FRONTEND_ORIGIN`: comma-separated exact origins. Local defaults allow
  `http://localhost:5173` and `http://127.0.0.1:5173`. Production must explicitly
  specify HTTPS origins, with no trailing slash or wildcard.

The frontend defaults to same-origin `/api`, with a Vite dev proxy to port 3000.
An explicit `VITE_API_BASE_URL` may be used for a same-site API origin. Serve the
frontend and API on the same site in production; unrelated domains are not
supported by the SameSite=Lax session design. Allowlist the frontend origin on
Express when using different origins. HTTPS/proxy deployment is a later task.

## API and browser behavior

- `POST /api/auth/login`: `{ username, password }`; generic 401 response for
  unknown users, wrong passwords and inactive users. Malformed inputs return 400.
- `GET /api/auth/me`: public user fields only (`user_id`, `username`, `role`) or 401.
- `POST /api/auth/logout`: revokes the current credential and clears its cookie.
- All customer/pet, appointment, service, report, expense and inventory APIs
  require authentication. `/api/test` remains a public non-business health check.

Requests from browsers use credentials and exact-origin CORS. Mutating requests,
including login/logout, require `X-Pet-Management-Request: 1`; the shared frontend
helper adds it automatically. Requests from untrusted origins are rejected.
API responses are marked no-store. Helmet adds security headers. JSON payloads
are limited to 100kb. Login allows 20 failed attempts per IP per 15-minute window.
Rate limits are in memory and reset on restart; multiple server instances will
need a shared limiter store. A reverse proxy's trusted-hop configuration must be
set deliberately during deployment before relying on client-IP rate limits.

The frontend checks `/me` before mounting business pages. A 401 from a business
request clears its authenticated state and returns to Login. More shows the
current account and Logout. Failed logout keeps the user signed in and offers
retry. A reload restores a still-valid session from the cookie.

ADMIN and EMPLOYEE currently have the same business API access. Roles are stored
for future access rules; this task does not add an employee-management UI,
password reset, public registration, or external identity providers.

## Validation and manual testing

Start backend and frontend in two terminals with `npm run dev` in their respective
directories. Open `http://localhost:5173` (use the matching host consistently).

1. Without a session, verify only Login appears. A direct request to
   `http://localhost:3000/api/customers` should return 401.
2. Enter an incorrect password and then a nonexistent username. Both show
   `Invalid username or password.`
3. Log in with the ADMIN created above. Verify Calendar, Customers and all More
   sections work. Reload and confirm the session is restored.
4. In browser developer tools, the session cookie is HttpOnly and SameSite=Lax;
   production additionally sets Secure. Auth responses have no password hash.
5. Choose More → Logout. Login appears without a browser reload. Reusing the old
   cookie against a protected API returns 401.

With the backend running, automated checks are:

```powershell
npm run test:auth
npm run test:workflow
npx tsc --noEmit
npm run typecheck:tools
```

The tests create randomized temporary credentials and marked business records,
then remove only their own records. They never print credentials. In `frontend`,
run `npm run build` and `npm run lint`. No real account password is required for
the smoke tests.

Authentication tests also simulate inactivity and original-login ages to check
30-day renewal, concurrent renewal, unchanged original login time, the 90-day
cap, expired-session rejection, matching cookie deadlines and logout revocation.
