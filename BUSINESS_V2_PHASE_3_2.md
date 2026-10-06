# Business V2 Phase 3.2

Completed on `feature/business-v2`. No payment feature, production access,
deployment, commit, push or merge. Earlier valid uncommitted work is preserved.

## 1. Required travel behavior

New appointments start with an empty **请选择交通费** placeholder under
**上门交通费**, marked with a required asterisk. No option is auto-selected or fabricated. The create action is
disabled until an option and valid amount are chosen; submission also validates
the draft. A configured active 免交通费/RM0 works only when explicitly selected.
An unfilled/negative/over-precision/out-of-range manual fee prevents saving.
If no active catalog options exist, the form points employees to travel management.

The API requires request-only `travel_fee_option_id`, label and amount. It
SHARE-locks the active option, verifies the current label and exact preset price,
or accepts the valid actual amount for a NULL-priced/manual template such as
15公里以上. Missing/fabricated/inactive choices and preset overrides return 400.

The option ID is **not persisted**: appointment still stores label and actual
amount directly, with no catalog FK. Recorded historical fees survive later
catalog edits/deactivation and untouched/note-only appointment edits.

## 2. Legacy NULL

The schema/migrations are unchanged and remain nullable. NULL means historical
travel is unrecorded, not an explicit zero. Detail/completion/history display
未记录 for that case; real zero displays RM0.00. Canonical totals continue to
COALESCE historical NULL travel to zero without changing stored values.

Saving an edit of a confirmed legacy NULL booking requires an active selection.
The legacy edit form explains this and disables save until chosen. Existing
recorded fees may be retained without silently repricing them. No backfill or
NOT NULL conversion was performed.

## 3. Lazy customer history and pagination

Opening customer details calls overview for contact, pets and canonical summary
values only (addresses use their existing separate API). Overview no longer
executes a rich history query and no longer returns appointment_history.

**查看预约记录** triggers:
`GET /api/customers/:id/appointments?limit=10&offset=0`.

The response is `{appointments,limit,offset,has_more,next_offset}`. Default page
size is 10; API maximum is 20. Parameters are strictly validated; nonexistent
customers return 404 and an empty history returns []. Sorting is date/time/ID
descending. The database reads limit+1 lightweight IDs as a sentinel, then scopes
pet aggregation and service/addon/location details to only the requested page's
IDs. It never fetches an unlimited detailed list or counts detailed history.

**加载更多** fetches one page. Chinese loading, empty, error and retry states are
present. Cache/in-flight deduplication is per customer within CustomersPage's
lifetime. Section and customer close/reopen reuse requested pages; no eager fetch
occurs. Customer/pet edits invalidate affected cached history; leaving the page
discards the cache. Canonical backend totals, statuses, addons and snapshots stay
available; frontend does not invent another financial formula.

Browser request-log proof with 24 mock history records:
- Opening customer: overview only, **zero history requests**.
- First tap: limit=10/offset=0, **10 records**.
- Two load-more taps: offsets 10 and 20, **10 then 4 records**.
- Section and customer reopen: **no extra history requests**.
- Empty customer: **暂无预约记录**, no load-more action.

Final console review caught and fixed a sibling-key collision between addresses
and history. The repeated browser paging/reopen check had no warnings/errors;
a regression assertion protects the separate history key namespace.

## 4. Visual hierarchy and mobile checks

Booking-only CSS uses one muted brand tint/accent and stronger major headings for
客户, 宠物与服务, 服务地址, 上门交通费 and other information. Most headers measure
32px; the address header with its touch action measures 44px. White cards and
existing compact spacing remain. Nested pet cards have quieter 14px subheadings/
borders and no extra outer padding, so they do not compete with major sections.
No multicolor dashboard or global thicker-border treatment was introduced.

The computer-use skill's browser-first guidance was used with disposable mock
fixtures. New/multi-pet/manual booking, legacy editing and paginated history were
checked at **375 / 390 / 430px**: measured document widths equaled viewport
widths, no horizontal overflow, all form controls **16px**, and native date/time
inputs stayed within their parents. The transparent backdrop remained transparent;
selected-date state cleared on dismissal. Desktop 1280px had no document overflow.

A real iPhone still needs to verify header readability/scroll scanning, long-sheet
touch comfort, native pickers, Safari 100% focus behavior and safe-area/browser
chrome interactions. Viewport checks do not emulate real iOS Safari.

## 5. Validation results

| Check | Result |
|---|---|
| Frontend build | PASS |
| Frontend lint | PASS |
| Frontend mocked/SSR/client/cache tests | 19 passed, no skips |
| Backend source type-check | PASS |
| Backend tools/tests type-check | PASS |
| Backend build | PASS |
| Authentication tests | PASS |
| Workflow + Business V2 tests | PASS |
| Deployment smoke tests | PASS |
| Unchanged-schema fresh/004 preservation tests | PASS |
| Git whitespace check | PASS |

Tests cover missing/invalid/inactive travel choice, stale preset price, explicit
configured zero, manual amounts, legacy NULL editing/reading, summary versus
paginated history shape, bounded/invalid/empty pages, no duplicate IDs and canonical
financial totals. Frontend checks also cover lazy initial rendering, concurrent
request deduplication, reopen reuse, load-more, empty/error/retry, legacy rendering,
independent addons and final-charge semantics.

Backend testing used a **new disposable UTF-8 cluster** and dedicated API-test
database/ports. No existing local or production database was accessed. Only
owned QA fixture records were removed; temporary servers/cluster are cleaned up.
No ignored environment secrets were edited.

Before/after SHA-256 checks confirmed unchanged database schema/migrations/tests,
authentication, address API/forms, global CSS, viewport metadata, Calendar and
BottomSheet code. Thus Phase 3.2 needs no schema migration. If the existing local
V2 database still uses the pre-3.1 unreleased model, the earlier 3.1 recreation
instruction still applies; this pass does not recreate that existing database.

## 6. Complete changed-file inventory

25 files compared with the start of this pass, excluding earlier dirty work
and ignored build outputs:

```text
BUSINESS_V2_BACKEND.md
BUSINESS_V2_FRONTEND.md
BUSINESS_V2_PHASE_3_2.md
BUSINESS_V2_SCHEMA.md
backend/src/business/appointmentBooking.ts
backend/src/business/appointmentQueries.ts
backend/src/controllers/customerController.ts
backend/src/routes/customerRoutes.ts
backend/tests/businessV2Smoke.ts
backend/tests/workflowSmoke.ts
frontend/src/businessV2.css
frontend/src/components/appointments/AppointmentExtrasFields.tsx
frontend/src/components/appointments/AppointmentV2Details.tsx
frontend/src/components/appointments/CompleteAppointmentForm.tsx
frontend/src/components/appointments/EditAppointmentSheet.tsx
frontend/src/components/customers/CustomerAppointmentHistory.tsx
frontend/src/components/sheets/NewAppointmentSheet.tsx
frontend/src/pages/CustomersPage.tsx
frontend/src/services/customerService.ts
frontend/src/types/appointment.ts
frontend/src/types/customer.ts
frontend/src/utils/businessV2.ts
frontend/src/utils/customerHistoryStore.ts
frontend/tests/businessV2.test.mjs
frontend/tests/qaServer.mjs
```
