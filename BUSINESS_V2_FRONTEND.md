# Business V2 frontend — Phase 3.2 corrected policy

This document supersedes the unreleased Phase 3 species/rule-catalog assumptions.
The Simplified Chinese, compact mobile-first UI and all existing calendar,
BottomSheet, transparent backdrop, safe-area and native date/time behavior remain.

## Employee flows

- Pet breed is optional free text, labeled **品种**. Remarks are separate. Stored
  breed/type values are displayed without species inference or rewriting.
- 服务管理 supports BASE/ADDON, name, price and active state, with simple kind filters
  and Chinese 409 feedback. It has no pet-applicability editor.
- Booking has one BASE and independent multi-ADDON checkboxes per pet. All active
  choices are available irrespective of breed; employees pick the appropriate named
  service. Original inactive choices may stay on the original pet.
- Immediate quote previews include addons once, then travel once. Backend quotes
  remain authoritative; no booking payload writes final pet amount.
- 客户资料 retains reusable text/map address forms, default/active management, safe
  map links and inline booking address creation. New bookings auto-select an address
  default only; edits preserve the original location snapshot unless changed.
- 更多 has a separate **上门交通费管理** entry: list/add/edit label/price, manual toggle,
  activate/deactivate and order. NULL option price means manual; numeric zero is an
  intentional free template. Catalog changes never mutate old bookings.
- Travel is one appointment-level selector fetched from the API. New bookings start
  at **请选择交通费**, with an asterisk marking **上门交通费** as required. Create remains disabled
  until an active option and valid price are selected. No automatic RM0 entry exists.
  Management may explicitly configure 免交通费/0, which employees must then choose.
- Selecting a preset copies its label and price; manual templates (including 15km+)
  require an actual amount. The request-only option ID lets the backend validate the
  active catalog choice but is not persisted. An invalid/incomplete manual fee prevents
  saving and makes the overall estimate incomplete.
- Recorded travel on an edit can remain historical via **保留原交通费**, even after
  catalog changes. A legacy NULL booking must choose a current option before saving.
  Historical NULL is shown as **未记录**, distinct from real RM0.00.
- Customer overview no longer fetches detailed history. **查看预约记录** fetches the
  first 10 records; **加载更多** fetches one further page. Loading/empty/error/retry
  states are Chinese. Cached pages and in-flight requests survive section/customer
  close/reopen while on CustomersPage, avoiding duplicate requests. Local customer/
  pet edits invalidate that customer's cache; leaving the page resets it.
- Booking sections use one muted brand tint/accent with stronger headings, while
  pet cards are grouped under **宠物与服务** with quieter headings/borders. Header
  height stays compact (32px, 44px with an action), existing spacing/control widths
  remain, and no global layout or status-color redesign is introduced.
