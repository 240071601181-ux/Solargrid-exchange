# Implementation status

Snapshot: 2026-10-26 - secure role-based marketplace and existing control room

## Bottom line

SolarGrid Exchange now has three authenticated workspaces on one backend:

- an **administrator** control room with the original eight operational pages;
- a **seller** workspace with account-owned solar, offers, sales, earnings,
  demand, forecasting, and profile settings;
- a **buyer** workspace with account-owned demand, marketplace purchase flow,
  purchases, usage, price outlook, and profile settings.

Authentication, authorization, ownership filtering, offer lifecycle, and direct
purchases are enforced by the backend. Sessions use opaque server-side tokens in
HttpOnly cookies plus double-submit CSRF protection. Public registration can
create only sellers and buyers; administrators are provisioned through the
environment or `python -m app.admin_cli`.

The original microgrid simulation, real MCP weather, dynamic pricing,
maximum-flow allocation, transaction ledger, evaluation, WebSocket, and settings
behavior remain intact. This is still a single-node simulation: no real metering,
payments, settlement, or production deployment is included.

## Delivered

### Authentication and security

- `users`, `user_sessions`, `seller_profiles`, and `buyer_profiles` models.
- Normalized unique emails; Argon2id hashing with a dummy verification path for
  unknown emails and a generic invalid-login response.
- Password policy: 10-128 characters, at least one letter and one digit.
- Opaque session tokens stored as SHA-256 hashes; HttpOnly `sg_session` cookie
  with a configurable 12-hour default lifetime.
- Readable `sg_csrf` cookie and required `X-CSRF-Token` header on state-changing
  API requests. Tokens are rotated on login, bound to the active server-side
  session, refreshed once by the client after a CSRF rejection, and validated
  before anonymous login/registration proceeds.
- Same-origin `/api` and `/ws` paths in development through the Vite proxy, so
  the `SameSite=Lax` cookies work identically at `localhost` and `127.0.0.1`.
- Sliding-window login and registration rate limits.
- Session restoration, logout revocation, expiry handling, and `next` redirects.
- No auth material in `localStorage` or `sessionStorage`.
- Administrator bootstrap environment variables and an explicit CLI with
  `--reset-password`; no public administrator registration and no silent account
  promotion.
- Frontend route guards for anonymous, seller, buyer, and admin access. The
  backend independently returns `401`/`403` and filters private data by owner.

### Data model and migration

- Additive migration for account tables and `households.owner_user_id`.
- Account-owned households are persisted in the existing household table and
  excluded from the eight seeded admin simulation households.
- `energy_offers` with ownership, quantity, remaining quantity, price, note, and
  lifecycle status.
- `purchase_orders` with buyer/seller ownership links, server-authoritative price
  and total, and an optional linked transaction.
- Marketplace purchases create a linked `AllocationRun` with
  `source="marketplace"` and `algorithm="direct_offer_purchase"`, plus a
  `Transaction` with `source="marketplace"`.
- Admin reset removes simulation-source runs and transactions but preserves
  marketplace purchase ledger records.
- SQLite WAL, foreign keys, and additive startup migration are retained.

### Backend API

- Public auth endpoints: CSRF, session, register, login, logout.
- Authenticated shared endpoints: shared status, weather, forecast, pricing, and
  active marketplace offers.
- Seller-only endpoints: dashboard, profile, solar, forecast, offers, offer
  availability/detail, offer create/edit/status, sales, earnings, and aggregate
  demand.
- Buyer-only endpoints: dashboard, profile, purchases, purchase creation,
  spending, usage, and prices.
- Administrator-only endpoints: households, simulation, optimization,
  transactions, evaluation, settings, and metrics summary.
- Direct purchase is transactional:
  - client price is ignored;
  - active offer and remaining quantity are rechecked;
  - remaining quantity is decremented atomically;
  - oversell requests return `409`;
  - purchase and linked transaction records are committed together.

### Frontend

- Public `/login` and `/register` screens with validation and accessible errors.
- Shared `AuthProvider` for session restoration, login, registration, logout,
  expiry events, and role home routes.
- Role-aware `AppShell`, sidebar groups, topbar identity/status, account menu, and
  logout.
- Seller routes: `/seller`, `/seller/solar`, `/seller/offers`,
  `/seller/marketplace`, `/seller/sales`, `/seller/earnings`,
  `/seller/forecasting`, `/seller/settings`.
- Buyer routes: `/buyer`, `/buyer/marketplace`, `/buyer/purchases`,
  `/buyer/usage`, `/buyer/prices`, `/buyer/settings`.
- Administrator routes remain `/`, `/microgrid`, `/marketplace`,
  `/forecasting`, `/optimization`, `/transactions`, `/evaluation`, `/settings`.
- Marketplace search, price/quantity filters, sorting, cheapest-price summary,
  pluralized result count, purchase confirmation, and success/error states.
- Seller offer create/edit/pause/resume/cancel interfaces with confirmation for
  cancellation and server-side availability errors.
- Loading gates, empty states, API error messages, restricted-workspace screen,
  responsive single-column layouts, and mobile navigation.
- Buyer dashboard label corrected to "Forecast deficit"; seller simulated value
  now shows two decimals; mobile topbar status badge is hidden below `sm` so the
  page title remains readable.

### Verification and documentation

- Eight new verification screenshots and a 40-check browser record.
- README rewritten for roles, routes, security, sessions, CSRF, admin
  provisioning, API authorization, testing, browser QA, and limitations.
- `.env.example` extended with session, CSRF, rate-limit, and bootstrap settings.

## Verification results

### Backend

```powershell
cd D:\frontend\backend
$env:PYTHONPATH='D:\frontend\backend'
.\.venv\Scripts\python.exe -m pytest -q
```

Result: **64 passed**, 1 warning in 21.83s.

The warning is the benign Starlette/httpx `TestClient` deprecation notice. New
coverage includes registration, login, logout, session restoration, expired
sessions, generic failures, valid/missing/invalid CSRF headers and cookies,
unrelated-session token rejection and rotation recovery, cookie security
attributes, CORS allow/deny behavior, rate limits, role boundaries, cross-account
ownership, offer lifecycle, purchase price authority, transaction linkage, and a
file-backed concurrent oversell test.

### Frontend

```powershell
cd D:\frontend
npm run typecheck
npm run lint
npm run test
npm run build
```

Results:

- strict TypeScript typecheck: passed;
- ESLint: passed;
- Vitest: **39/39 passed**;
- production build: passed;
- bundle: main JS about 1.01 MB (277 KB gzip), Vite chunk-size warning only.

The test suite covers auth validation, login/logout, session restoration and
expiry, guard loading/redirects, wrong-role blocking, role navigation, seller
offer actions, buyer marketplace empty/error/confirmation behavior, client price
omission, CSRF refresh/retry handling, same-origin URL resolution, and API
failure handling.

### Live API smoke checks

Against the running backend on `http://127.0.0.1:8010`:

- anonymous seller dashboard and shared status returned `401`;
- seller, buyer, and administrator logins returned `200`;
- seller and buyer routes rejected the wrong role with `403`;
- seller -> simulation and buyer -> settings returned `403`;
- admin -> shared status returned `200`; admin -> seller offers returned `403`;
- state-changing request without CSRF returned `403`;
- invalid credentials with valid CSRF returned generic `401`;
- logout returned `204` and subsequent session restoration returned `user: null`;
- seller offer create/pause/resume worked;
- buyer purchase used the offer price (`INR 7.25/kWh`) even when the client sent
  `price_inr_kwh: 0.01`;
- over-quantity purchase returned `409`;
- purchase appeared in the buyer ledger and seller sales;
- shared status reported live Open-Meteo data over MCP (`provider=open-meteo`,
  `transport=mcp-stdio`, `status=live`);
- buyer price forecast returned 24 points.

### Browser QA

Result: **40 passed, 0 failed**, with **0 console errors, 0 page errors, and 0
HTTP 5xx responses** in Chromium.

Coverage included:

- anonymous redirect with preserved `next` path;
- login form and role-specific sign-in;
- HttpOnly session cookie, readable CSRF cookie, and empty browser storage;
- delayed session restoration gate with no private-content flash;
- all seller routes and offer create/pause/resume/cancel through the UI;
- all buyer routes, confirmed purchase, and updated purchase ledger;
- wrong-role restricted-workspace screen;
- missing/expired session redirect;
- all administrator routes and control-room availability;
- mobile 390 px layout with zero horizontal overflow and working navigation.

Artifact: `docs/browser-verification.json`.

A focused CSRF/host-consistency pass re-ran both `http://localhost:5173` and
`http://127.0.0.1:5173`: **35/35 checks passed**, including invalid and valid
credentials, registration, same-origin API/WebSocket traffic, HttpOnly/readable
cookie separation, seller route restrictions, and operator `/settings` access.
A separate forced-stale-token browser check observed `403` -> `/auth/csrf`
refresh -> retried logout `204`. No CSRF `403`, API `5xx`, page errors, or
unexpected console errors occurred on the normal flows.

Screenshots: `docs/screenshots/login.png`,
`seller-dashboard.png`, `seller-offers.png`, `buyer-dashboard.png`,
`buyer-marketplace.png`, `admin-overview.png`, `mobile-buyer-marketplace.png`,
and `mobile-navigation.png`.

### MCP weather proof

Verified server `open-meteo-weather 1.30.0` exposing `get_current_weather` and
`get_weather_forecast`. The captured provider response reported `status: ok`,
`28.6 C`, `91%` cloud cover, and `480 W/m2` irradiance. Raw evidence remains in
`docs/mcp-verification.txt`; live values change.

## Measured evaluation

Replay starts at the first forecast hour with at least 500 W/m2 irradiance
(`2026-10-27T03:30:00Z` / 09:00 IST). Both sides use the same inputs.

### Positive case - 24 intervals, 25% cloud

| Metric | Static | Dynamic |
| --- | ---: | ---: |
| Traded | 1.3498 kWh | 1.4263 kWh |
| Unmet demand | 1.6954 kWh | 1.6189 kWh |
| Utilization | 92.22% | 97.44% |
| Avg. price | INR 6.0000/kWh | INR 7.0092/kWh |

Unmet demand reduction: **0.0765 kWh / 4.51%**; utilization **+5.22 pp**.

### Negative case - 48 intervals, 0% cloud

| Metric | Static | Dynamic |
| --- | ---: | ---: |
| Traded | 4.5635 kWh | 3.8558 kWh |
| Unmet demand | 0.5246 kWh | 1.2320 kWh |
| Utilization | 47.10% | 39.80% |
| Avg. price | INR 6.0000/kWh | INR 5.0957/kWh |

Dynamic increased unmet demand by **0.7074 kWh** and reduced utilization by
**7.3 pp**. The UI reports this outcome without masking it.

## Known boundaries

- Weather is provider-reported for one shared location; solar output is
  estimated, not metered.
- Demand, battery behavior, dynamic prices, allocation, offers, purchases, and
  transactions are simulated. No money moves.
- No electrical network constraints, voltage/frequency analysis, protection, or
  congestion modeling.
- No production settlement, payment, blockchain, smart-meter, or inverter
  integration.
- Evaluation is a counterfactual replay, not measured field performance.
- SQLite, the in-process rate limiter, and the in-process WebSocket hub are
  single-node choices.
- Session cookies use `Secure=false` for local HTTP; production must use HTTPS
  and set `SESSION_COOKIE_SECURE=true`.
- No password reset, email verification, MFA, account deletion, external session
  store, or formal audit logging.
- `email-validator` could not be installed; a documented custom email regex is
  used.
- Browser QA is Chromium-only; no Firefox/Safari or formal WCAG audit.
- The main production JS bundle exceeds Vite's 900 KB warning threshold.
- Local SQLite contains verification accounts, seeded households, purchases, and
  cancelled QA offers. Use admin Reset for simulation history or remove
  `backend\data\microgrid.db*` for a completely clean database.
- No Docker/Kubernetes deployment or production observability is included.

## Environment notes

- Port `8000` is occupied on the delivery host; the backend and `.env` use
  `8010`.
- Backend virtual environment: Python 3.13.5.
- Frontend: Node 24.18.0 / npm 11.16.0.
- Weather needs no API key. No cloud, payment, hardware, or blockchain
  credentials are configured or required.
- The workspace currently has local verification data, including administrator,
  seller, and buyer QA accounts. Credentials are not committed to the repository;
  provision or rotate them locally.

## Suggested next steps

1. Add password reset, email verification, MFA, and session/device management.
2. Move rate limiting and sessions to a shared production store; serve over HTTPS
   with secure cookies.
3. Code-split the frontend routes and address the build chunk-size warning.
4. Add a formal route-by-route authorization matrix and a checked-in Playwright
   end-to-end suite.
5. Replace synthetic household profiles with meter/inverter adapters and add
   battery efficiency, degradation, and electrical constraints.
6. Define a real settlement boundary before any non-simulated marketplace use.
