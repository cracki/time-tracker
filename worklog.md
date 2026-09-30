# Worklog

---
Task ID: 1
Agent: main (Super Z)
Task: Build complete frontend (Phase 1 UI Prototype) for Time Tracking PWA per uploaded spec — mobile-first, RTL Persian, Vazirmatn, mock data, no backend.

Work Log:
- Read full specification (105 sections) from upload dir.
- Initialized fullstack environment (Next.js 16 + Tailwind 4 + shadcn/ui).
- Decisions:
  - Spec says Vite SPA; sandbox mandates Next.js 16 App Router → single `/` route with hash-based client router (spec-compliant SPA behavior, back-button works).
  - Spec suggests Chart.js; `recharts` already in stack (spec Rule 13) → use recharts, lazy-loaded via next/dynamic.
  - Font: `vazirmatn` npm package (self-hosted woff2), RTL + fa lang on <html>.
  - OTP mock: code shown in UI hint (no SMS in prototype). Demo accounts quick-fill on login.
  - Offline drafts: IndexedDB (per spec §32/33), never localStorage for logs.
- Built design system: globals.css tokens (teal primary, status tokens pending/approved/adjusted/rejected/outside per §27, light+dark), safe-area utils, reduced-motion.
- Core libs: jalali.ts (full jalaali algorithm, presets, formats), duration.ts (minutes↔HH:MM), format.ts (Persian digits), types.ts, mock-db.ts (22 users, 1300+ seeded logs, holidays, calendar), mock-api.ts (latency + business rules: backdate limit, edit rules, adjust semantics), offline-drafts.ts (IndexedDB), sim-offline.ts.
- Navigation: hash router + role guard; auth via sessionStorage.
- Components: AppShell (bottom nav + center FAB mobile / sidebar desktop), PageHeader, StatusBadge/OutsideBadge, StatCard + AnimatedNumber, TimeLogCard (adjusted shows 02:30 → 03:00), DurationInput (masked, diff-based parsing), PersianDatePicker (Jalali grid, holiday dots, min/max), DateRangeFilter, LogActions (approve/adjust/reject bottom sheets), charts (trend/donut/people bars/heatmap), states (skeleton/empty/error/offline), SyncStatusChip/OfflineBanner.
- Screens: Login, OTP, Collab Home, Log Form (create/edit/copy), My Logs, Log Detail, Stats, Account; Admin Dashboard, Admin Logs, People, Person Summary, Reports (time + outside tabs), Outside Hours, Calendar Settings, Holidays, More.
- PWA: manifest.webmanifest, sw.js (prod-only registration; dev unregisters to keep HMR fresh), icons generated via scripts/gen-icons.py (192/512/maskable/apple/favicon), install prompt + update toast UX.

Bugs found & fixed during browser verification:
1. Missing AuthProvider/RouterProvider wrappers in page.tsx.
2. mock-db crash: pick() could select null then .slice() → replaced with string.
3. AppShell isActive received route object instead of path string.
4. Service Worker cached dev chunks cache-first → froze HMR (stale modules) → SW now prod-only + dev cleanup.
5. DurationInput mask swallowed padded zeros when typing ("۰۰:۰۱"+"4" → 0001) → rewrote handler as diff-against-display.
6. Duplicate draft sync from multiple hook instances → singleton in-flight lock in draftApi.syncDrafts.
7. Desktop table clipped actions column → wider content column (max-w-5xl) + overflow-x wrapper.

Stage Summary:
- All Phase-1 prototype screens implemented and browser-verified (mobile 390×844 + desktop 1440×900, light + dark).
- ESLint clean; dev server serving 200s; no runtime errors in latest requests.
- Deliverable: runnable Next.js app in /home/z/my-project (preview via port 3000).

---
Task ID: 2
Agent: main (Super Z)
Task: Rename لگ → گزارش across the whole project; make OTP code input left-to-right (like math).

Work Log:
- Grepped whole repo: 65 occurrences of "لگ" in 20 files, all under src/ (UI strings, toasts, aria-labels, rejection reasons, comments). Verified no other word contains "لگ" as substring → safe global replace.
- Applied `sed s/لگ/گزارش/g` to all 20 files (compound forms handled correctly: لگ‌ها→گزارش‌ها, لگی→گزارشی). Post-check grep: 0 remaining.
- OTP direction root cause: `input-otp` lib only forwards the `dir` prop to its hidden <input>, not the visual container div → slots inherited `dir=rtl` from <html>, so slot 1 appeared rightmost.
- Fix in otp-screen.tsx: added `dir="ltr"` to the wrapper div around <InputOTP> (inherits into visual container; hidden input already had dir=ltr) + dir="ltr" on the sample-code hint span. Documented with comment.
- Verified in browser (390×844): typed "12" → slots left-to-right read ۱|۲|·|·|· (slot 1 leftmost). Screenshot: download/verify-29-otp-ltr.png. Home screen accessibility snapshot shows "گزارش" everywhere.

Stage Summary:
- No "لگ" left anywhere in project UI; all user-facing text now uses "گزارش".
- OTP code now fills left→right like math on both input and hint display; page RTL layout untouched.
- ESLint clean, dev server 200.

---
Task ID: 3
Agent: main (Super Z)
Task: Fix "شما در حالت آفلاین هستید" appearing repeatedly during login.

Work Log:
- Root causes found:
  1. mock-api assertOnline() gated ALL 22 API methods (incl. requestOtp/verifyOtp) on `navigator.onLine` — false-positives in WebViews/preview iframes/VPNs blocked login with offline errors.
  2. useNetworkStatus trusted navigator.onLine directly → false offline banner/pill in lying environments.
  3. Sim-offline demo toggle (Account screen) had no reset on sign-out → stuck state: toggle ON + logout = login blocked with no way to turn it off.
- Fixes:
  1. assertOnline() now checks ONLY isSimOffline() (mock API never touches network; real connectivity belongs to backend phase). assertOnline removed entirely from requestOtp/verifyOtp — login always works.
  2. useNetworkStatus: offline report from navigator.onLine is now confirmed with a same-origin HEAD probe (/manifest.webmanifest, 4s abort, no-store) before showing offline UI. Real offline fails the probe fast; lying environments succeed.
  3. signOut() resets sim-offline (module flag + documentElement.dataset) — escape hatch.
- Browser-verified (390×844): (a) navigator.onLine forced false → login + OTP + home with NO offline toast/banner; (b) real offline (Playwright setOffline) → probe fails → banner shows, reconnect clears it; (c) sim toggle ON → banner shows → sign out resets flag → re-login clean.
- Note: [role=status] selector matched home success message during testing — use body text match for banner checks. OTP fill via execCommand insertText for automation (Playwright type into hidden input is unreliable).
- Screenshots: verify-30-home-no-offline.png.

Stage Summary:
- Login never blocked by false offline detection; offline UI (banner/pill/chip) only appears on confirmed real offline or explicit sim toggle.
- Sim-offline demo feature intact and self-cleaning on sign-out.
- ESLint + tsc clean.
- Bonus: fixed 3 pre-existing tsc errors in src (persian-date-picker setView missing jd; time-log-card optional onReject?.(); charts ChartBox made generic which surfaced TrendBody's unbound height prop — now wired through). tsc: 0 errors in src/.

---
Task ID: 4
Agent: main (Super Z)
Task: Real backend (Phase 2) — replace mock API with Next.js API routes + Prisma/SQLite; admin user management (create/edit/activate/delete).

Work Log:
- Prisma schema: User (mobile unique, role, isActive, avatarColor), TimeLog (status/outsideKind/adminNote/approvedBy…, indexes userId+workDate/status/workDate), Holiday (date unique), CalendarSettings (singleton, workingDays JSON), OtpSession (sha256 code, attempts, cooldown), Session (token cookie). db:push OK.
- Server libs: api-helpers (ServerError → Persian {error,code} JSON), auth (cookie tt_session, httpOnly SameSite=Lax, 30d; requireUser/requireAdmin), rules (Tehran-today ISO via Intl, backdate window, jalali weekday, computeOutsideKind), data (calendar singleton, holiday set, serializers).
- API routes (17): auth request-otp/verify-otp/logout/me; logs GET/POST + [id] GET/PUT/DELETE (owner-or-admin detail); collab dashboard/stats; admin dashboard/logs(+filters,paging)/decision(approve|adjust|reject)/people/people[id]summary/outside-hours/users/users[id]; settings/calendar GET(user)/PUT(admin); settings/holidays POST + [id] DELETE. Business rules enforced server-side (pending-only edits, backdate 3d, attempts≤3, cooldown 30s).
- User management protections: self-lockout (can't demote/deactivate/delete self), last-active-admin guard, unique mobile, delete blocked when user has logs (suggest deactivate).
- Seed (scripts/seed.ts): 22 users (2 admins), 1311 logs / 50 days, 20 holidays (2 Jalali years), default calendar. Demo: admin 09121000000 (علی رضایی), collab 09121111111 (مریم احمدی).
- Client: new src/lib/api.ts (fetch layer, identical interface to old mock-api — screens untouched conceptually); sim-offline gate kept client-side; network failures map to code "offline" so IndexedDB draft flow works against real backend. Deleted mock-api.ts + mock-db.ts. AuthProvider now cookie-session via /api/auth/me (loading→splash). Screens de-mocked: login (hardcoded demo chips), more (pending count via API + new "مدیریت کاربران" item), admin-logs/admin-dashboard (users via usersApi), log-detail (new GET /api/logs/[id] with user), log-form (calendarApi.get() + computeOutsideKind client hint).
- New UsersScreen (/users, admin): search, list (avatar/role/active/logCount), create + edit bottom sheets (name/mobile/role/avatar color), activate switch, delete confirm dialog; entry points from More + People header; ADMIN_PATHS + router updated.

Bugs found & fixed during verification:
1. UsersScreen crash: isSelf(editing!) on null (sheet children evaluate eagerly) → null-safe isSelf.
2. GET /api/settings/calendar initially admin-only but collab log form needs it → requireUser.
3. Generic ChartBox typing surfaced TrendBody's unbound height prop (pre-existing) → wired height through.
4. tsc pre-existing errors in persian-date-picker (missing jd) and time-log-card (optional onReject) fixed.

E2E verified (agent-browser, 390×844): collab login via real OTP → create log → appears in my-logs; signout; admin login → dashboard KPIs/charts real data → quick-approve pending log; /users full CRUD (create → deactivate → delete) + protections (delete-with-logs blocked, duplicate mobile inline error); all pages render clean (reports/outside/calendar/holidays/people/logs/users); ESLint + tsc clean; screenshots verify-31-users-backend.png.

Stage Summary:
- Backend live: SQLite via Prisma, cookie sessions, server-enforced rules, Persian error envelope.
- Admin user management shipped (user's explicit requirement).
- Offline drafts + sim-offline demo preserved on the real client layer.

---
Task ID: 5
Agent: main (Super Z)
Task: De-prototype the app — verify everything is fully dynamic/backend-driven, implement remaining fake pieces, harden security (user request: "همه چیز کامل داینامیک شده و توسط بکند پیاده سازی شده؟ برنامه از حالت پروتوتایپ خارج بشه و عملیاتی بشه").

Work Log:
- Full audit: all 20 screens import from real api.ts layer (fetch over 19 API routes); zero hardcoded data arrays in features/; sw.js confirmed to never cache API responses.
- Real PDF report export (was the last fake API: setTimeout 700ms):
  - New GET /api/admin/report/export?from&to&tab (requireAdmin): server-rendered print-optimized HTML built from live DB data — time tab (per-person logged/approved/diff/count + totals) and outside tab (per-person summary + full detail rows with kind labels), RTL, A4 @page CSS, Vazirmatn Regular+Bold embedded as base64 (module-cached), HTML-escaped, Jalali dates server-side.
  - api.ts: fake calendarApi.generatePdf removed; new reportsApi.getPrintableReport via requestText transport (same error envelope).
  - src/lib/print.ts: printHtml() — hidden iframe srcdoc → contentWindow.print() ("Save as PDF" = the file), window.open fallback for WebViews.
  - reports-screen wired: button fetches live HTML for active tab + range, opens print dialog, Persian toast guidance.
- Session security: Session rows now store sha256(token) instead of raw token (createSession/getSessionUser/destroySession all hash); one-off script cleared 1 legacy raw-token row; expired-session deleteMany on create (hygiene).
- OTP: expired OtpSession rows cleaned opportunistically in request-otp; SEND_SMS flag added (false in sandbox → devCode returned; flip true + wire provider at deployment, devCode omitted and UI hint box auto-hides — devCode/OtpScreen prop made optional).
- Strings/comments de-prototyped: APP_VERSION "1.0.0-prototype"→"1.0.0"; OTP hint "کد نمونه این پروتوتایپ"→"کد تأیید (حالت توسعه)"; login chips "پروتوتایپ"→"نسخه نمایشی"; all comments updated.
- Deleted: src/app/api/route.ts (Hello world) + scripts/test-mock-db.ts (leftover).
- Data fix: CalendarSettings workingDays had been left as [0,1,2,3] by an earlier test → restored default [0,1,2,3,4].

E2E verified (agent-browser 390×844, real OTP logins):
- Admin login (hashed session) → dashboard KPIs/charts from live DB (۱۷۱۶:۳۰ کل، ۱۱۲ در انتظار) → session persists across reload.
- Reports: time tab export → iframe contains "گزارش زمان تیم" table with real rows (first row فاطمه صادقی); outside tab → "گزارش خارج از ساعت اداری" + 7 summary + 14 detail rows; print() fired without errors.
- Export endpoint authz: no cookie → 401.
- Collab login (مریم) → home stats live → create log 01:45 → appears in my-logs (۶۴ گزارش) with dynamic outside-kind badge.
- Admin: approve test log → status تغییر به «تأیید شده» + toast; users CRUD re-verified (create 09129999999 → deactivate badge «غیرفعال» → delete gone).
- ESLint clean, tsc: 0 errors in src/, dev.log shows real Prisma queries + 200s, console clean.
- Screenshots: verify-31-admin-logs.png, verify-32-reports-real-pdf.png.

Stage Summary:
- App is now fully operational: every screen/data point (logs, statuses, dashboards, stats, reports, people, outside-hours, calendar, holidays, users) is served by the real backend (API routes + Prisma/SQLite) with server-enforced business rules.
- Last fake piece (PDF generation) replaced by a real print-to-PDF pipeline; session tokens hashed at rest; OTP SMS-ready via SEND_SMS flag.
- Remaining prototype-ish UI elements are intentional demo aids: login quick-fill chips (نمایشی) and dev OTP hint (auto-hidden once SMS connected).

---
Task ID: 6
Agent: main (Super Z)
Task: Production hardening + DX batch — Kavenegar SMS (Lookup), AI-generated app icons, compact+virtualized log lists, full test pyramid (unit/API/E2E) with deterministic test seeders, performance & responsive work, motion polish. (User: icons via image-gen? performance? responsive review? tests complete? test seeders? Kavenegar with env service number? animation plan? compact task list?)

Work Log:
- Kavenegar (sms-Lookup per kavenegar.com/rest.html#sms-Lookup): new src/lib/server/sms.ts — verify/lookup.json client (receptor normalization +98/98/10→09…, 10s abort, Persian SmsError mapping), generic sendSms for the operator's service line (KAVENEGAR_SENDER), config detection via SMS_PROVIDER/KAVENEGAR_API_KEY/KAVENEGAR_OTP_TEMPLATE. request-otp route rewired: env-driven (no more SEND_SMS const), SMS failure deletes the OTP session + 502 sms_failed code; misconfigured kavenegar in prod never leaks devCode. .env/.env.example added (user fills service number + key + template). Unit-tested with mocked fetch (URL/params/status mapping/timeout).
- Icons: generated with z-ai image-gen (1024², white stopwatch+checkmark on teal gradient) → scripts/build-icons.mjs (sharp) rebuilt ALL manifest/layout icon slots (icon-192/512, maskable-512, apple-touch-180, favicon-32/64) + saved original to download/app-icon-ai-1024.png.
- Compact log list: new CompactLogRow (~52px vs ~110px card, RTL-safe, inline adjusted 02:30←03:00, quick approve/reject/edit at 28px) + VirtualLogList (@tanstack/react-virtual useWindowVirtualizer, dynamic measure, Jalali day-group headers flattened as items) + density toggle (compact default, localStorage tt-log-density) on my-logs AND admin-logs mobile lists; React.memo rows. Virtualization verified: ~15-25 DOM rows for 4.8k px of content.
- Tests (111 total, all green): vitest unit 46 (jalali round-trips/leap/weekend, duration parser caps, format, server rules incl. backdate window + outside-kind + mobile regex, sms adapter); vitest API 56 black-box over real next dev :3100 with NEXT_DIST_DIR=.next-test (lock-safe) + isolated db/test.db; Playwright E2E 9 specs (mobile Pixel7 + desktop Chrome): login (wrong-OTP/inactive/devCode), log create→compact-list→edit, admin users CRUD + delete-with-logs guard, cooldown-retry helper.
- Seeders: scripts/seed-test.ts deterministic (4 fixed users incl. inactive + 2 admins, logs covering every status + weekend outside, 20 holidays, default calendar) — standalone `bun run db:seed:test` or imported by vitest/playwright global setups via tests/helpers/provision.ts (push schema + seed + server lifecycle). Demo seed kept as `bun run db:seed`.
- Bugs found by the new tests & fixed:
  1. OTP resend cooldown was DEAD CODE — cooldownUntil read but never written; now set on upsert (30s, server-enforced).
  2. Edit form crashed on client-side nav (detail→edit): React Query key collision — detail cached {log,user} envelope under ["log",id], form expected bare log → existing.description=undefined → crash on .length. Detail moved to ["log-envelope", id] + defensive prefill.
  3. VirtualLogList scrollMargin could go stale when content above shifted the list → rows mispositioned/clicks hitting wrong item; now re-measured on body/parent resize + items change (rAF-throttled).
  4. Tailwind 4 scanned .next-test*/ dirs (not gitignored) → corrupted candidate CSS broke globals.css build (500). Ignored in .gitignore + eslint ignores; NEXT_DIST_DIR env added to next.config.ts for lock-free second dev instance.
- Performance: server TTL cache (60s) for calendar+holidays with explicit invalidation on settings mutations (tested: admin PUT visible immediately); memo'd list rows; virtualized lists = constant render cost; font-display: swap confirmed; tsc/lint clean.
- Responsive audited 390/768/1024/1440/1920 (screenshots download/resp-*.png): bottom-nav→sidebar switch, max-w-5xl container, KPI 2→4 cols, tables only ≥lg, compact list scales cleanly.
- Motion: src/lib/motion.ts presets (fadeUp/stagger/pressSpring, reduced-motion handled globally in CSS); applied stagger to home KPI grid, subtle CSS entrance to virtual rows, StatCard hover lift; screens already fade+rise via framer (app-root).
- npm scripts: test / test:unit / test:api / test:e2e / db:seed / db:seed:test.

E2E verified: full test suite green (46+56+9), screenshots verify-33-compact-list.png, verify-34-cards-mode.png, resp-{390,768,1024,1440,1920}-*.png; ESLint + tsc clean; dev server 200.

Stage Summary:
- Kavenegar OTP is production-ready behind env (fill KAVENEGAR_API_KEY/SENDER/TEMPLATE + SMS_PROVIDER=kavenegar — devCode UI auto-hides).
- New AI icon set live across PWA surfaces.
- Log lists compact + virtualized for large datasets with density toggle.
- Full quality gate in place: bun run test (111 tests) with isolated test DB + deterministic seeders; E2E already paid for itself (2 real bugs + 2 infra bugs found and fixed).
- App remains fully operational on real backend; all data flows through Prisma/SQLite APIs.
