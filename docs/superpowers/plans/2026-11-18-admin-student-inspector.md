# Instructor Admin Sign-Up & Student Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add database-enforced single-instructor admin sign-up/elevation and a read-only Instructor Dashboard (`#/admin`) to inspect every student's SAT courseware progress.

**Architecture:** Store admin authorization in unexposed `private.admin_emails`, `private.admin_users`, and `private.admin_passcode_config` Postgres tables, exposing only `public.is_my_account_admin()` and `public.claim_instructor_admin(passcode text)` to `authenticated` users and extending `SELECT` RLS policies on `public.profiles` and `public.course_progress`. On the React frontend, expose `isAdmin` and `claimInstructorAdmin` in `useAuth`, add an optional Instructor Code toggle to `AuthPortal` + `TopContextHeader`, and render a read-only cohort roster and student drill-down inspector at `#/admin`.

**Tech Stack:** Supabase Postgres 17 (`pgcrypto`, RLS, PL/pgSQL), `@supabase/supabase-js` v2, React 19, TypeScript, Vite 6, Node `assert/strict` test scripts.

**Spec:** `docs/superpowers/specs/2026-11-18-admin-student-inspector-design.md`

## Global Constraints

- Admin authorization MUST NOT read `raw_user_meta_data` / `user_metadata`.
- Frontend source MUST NOT contain the plaintext instructor passcode (`SAT1400-INSTRUCTOR-2026`).
- Pre-authorized instructor email in `private.admin_emails`: `mikeperac@gmail.com` (case-insensitive).
- Admin policies MUST grant `SELECT` only on `public.profiles` and `public.course_progress` (never `UPDATE` or `DELETE` on another user's rows).
- Supabase security, performance, and health advisors MUST return `0` lints after migration.

## Review Focus

- Case-mixed or whitespace-padded email/passcode inputs (`"  MikePerac@Gmail.com "`, `" SAT1400-INSTRUCTOR-2026 "`) must normalize cleanly rather than failing admin recognition.
- Students with a `profiles` row who have not yet answered any questions (`progress_json = '{}'` or missing `course_progress` row) must render cleanly in the Instructor Dashboard with `0` counts rather than crashing.
- Navigating to `#/admin` as a non-admin or guest user must redirect or show an access-restricted card rather than rendering an empty broken dashboard.
- Viewing a student's drill-down inside `AdminDashboardView` must never mutate the admin's own `useCourseStore` state or trigger an upsert to the student's row.
- Frontend bundle (`src/`) must never embed the plaintext instructor passcode string.

---

### Task 1: Supabase Admin Schema, RPCs & RLS Migration

**Files:**
- Create: `supabase/migrations/20261118120000_add_instructor_admin_and_rls.sql`
- Modify: `src/types/supabase.ts`

**Interfaces:**
- Produces:
  - Postgres tables `private.admin_emails`, `private.admin_users`, `private.admin_passcode_config`
  - RPC `public.is_my_account_admin() -> boolean`
  - RPC `public.claim_instructor_admin(passcode text) -> boolean`
  - Updated RLS `SELECT` policies on `public.profiles` and `public.course_progress`
  - Updated TypeScript `Database['public']['Functions']` signatures in `src/types/supabase.ts`

- [ ] **Step 1: Write `supabase/migrations/20261118120000_add_instructor_admin_and_rls.sql` and apply via Supabase MCP `apply_migration`**

Include:
- `create extension if not exists pgcrypto with schema extensions;`
- `private.admin_emails(email text primary key)` seeded with `'mikeperac@gmail.com'`
- `private.admin_users(user_id uuid primary key references auth.users(id) on delete cascade, granted_at timestamptz not null default now(), reason text not null default 'allowlist')` backfilled from `auth.users` matching `lower(email)`
- `private.admin_passcode_config(id int primary key default 1 check (id = 1), passcode_hash text not null)` seeded with `extensions.crypt('SAT1400-INSTRUCTOR-2026', extensions.gen_salt('bf'))`
- Updated `private.handle_new_user()` so new `auth.users` rows whose `lower(email)` matches `private.admin_emails` also insert into `private.admin_users`
- `public.is_my_account_admin() returns boolean` (`language sql stable security definer set search_path = ''`, granted only to `authenticated`) checking `private.admin_users` or `auth.users` + `private.admin_emails` for `(select auth.uid())`
- `public.claim_instructor_admin(passcode text) returns boolean` (`language plpgsql security definer set search_path = ''`, granted only to `authenticated`) verifying `extensions.crypt(trim(coalesce(passcode, '')), passcode_hash) = passcode_hash` and inserting `(select auth.uid())` into `private.admin_users`
- Additional `SELECT` policies `profiles_select_admin` and `course_progress_select_admin` `for select to authenticated using ((select public.is_my_account_admin()))`

- [ ] **Step 2: Verify Postgres functions, RLS policies, passcode hash verification, and Supabase Advisors**

Run MCP `execute_sql` verification query testing:
1. `'mikeperac@gmail.com'` exists in `private.admin_emails`
2. `extensions.crypt('SAT1400-INSTRUCTOR-2026', passcode_hash) = passcode_hash` returns `true` and wrong passcode returns `false`
3. `anon` has `has_function_privilege('anon', 'public.is_my_account_admin()', 'EXECUTE') = false` and `authenticated` has `true`
Run MCP `get_advisors` (`security`, `performance`, `health`) -> Expected: `{"result":{"lints":[]}}` on all three.

- [ ] **Step 3: Regenerate `src/types/supabase.ts` with `Functions` (`is_my_account_admin`, `claim_instructor_admin`)**

Run `npx tsc -b` -> Expected: Exit `0`.

- [ ] **Step 4: Commit Task 1**

```bash
git add supabase/migrations/20261118120000_add_instructor_admin_and_rls.sql src/types/supabase.ts
git commit -m "feat(db): add private admin tables, passcode RPC, and instructor RLS policies"
```

---

### Task 2: Student Analytics Aggregator & Unit Tests

**Files:**
- Create: `src/utils/adminAnalytics.ts`
- Create: `scripts/verify-admin-analytics.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `CourseData` (`src/types/course.ts`), `ProfileRow` & `CourseProgressRow` (`src/types/supabase.ts`)
- Produces (`src/utils/adminAnalytics.ts`):
  - `export interface StudentOverviewRecord` (profile fields, summary metrics, R&W accuracy, Math accuracy, Day `1–7` step & question breakdown, recurring `3+` error codes, missed/flagged question details, custom/mastered vocab entries, daily reflections)
  - `export function buildStudentOverviewRecords(profiles: ProfileRow[], progressRows: CourseProgressRow[], course: CourseData): StudentOverviewRecord[]`

- [ ] **Step 1: Write failing test `scripts/verify-admin-analytics.mjs`**

Test cases (covering Review Focus items):
1. Student with solved R&W + Math items, vocab sentences, reflections, and `3` `E2` errors produces exact R&W/Math accuracy percentages, `recurringErrorCodes: ['E2 (3)']`, and missed question details matched against `courseData.json`.
2. Brand-new student with a `ProfileRow` and NO matching `CourseProgressRow` (or `{}` `progress_json`) produces `0` counts, `null` accuracy, `7` day summaries at `0/10`, and does not throw.
3. Security assertion scanning `src/` to verify `'SAT1400-INSTRUCTOR-2026'` does NOT appear anywhere in frontend source files.

- [ ] **Step 2: Run `node scripts/verify-admin-analytics.mjs` to verify it fails**

Expected: FAIL (`ERR_MODULE_NOT_FOUND` for `adminAnalytics`).

- [ ] **Step 3: Implement `src/utils/adminAnalytics.ts` and wire into `npm test` in `package.json`**

Ensure `npm test` runs `npm run compile:course && node scripts/verify-webapp.mjs && node scripts/verify-admin-analytics.mjs` (using Node `--experimental-strip-types` or clean shared module import).

- [ ] **Step 4: Run `npm test` to verify all checks pass**

Expected: PASS with both `verify-webapp.mjs` and `verify-admin-analytics.mjs` succeeding.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/utils/adminAnalytics.ts scripts/verify-admin-analytics.mjs package.json
git commit -m "feat(admin): add read-only student analytics aggregator and verification tests"
```

---

### Task 3: Auth Context Admin State, Instructor Sign-Up Passcode & Routing

**Files:**
- Modify: `src/types/course.ts`
- Modify: `src/state/useAuth.tsx`
- Modify: `src/state/useCourseStore.tsx`
- Modify: `src/components/AuthPortal.tsx`
- Modify: `src/components/TopContextHeader.tsx`
- Modify: `src/components/SidebarRail.tsx`

**Interfaces:**
- Consumes: `supabase.rpc('is_my_account_admin')`, `supabase.rpc('claim_instructor_admin', { passcode })`
- Produces:
  - `RouteView` union extended with `| { kind: 'admin' }` (`#/admin`)
  - `useAuth()` extended with `isAdmin: boolean`, `claimInstructorAdmin: (passcode: string) => Promise<AuthActionResult>`, and optional `instructorCode?: string` parameter on `signUpWithEmailPassword` (also stashing pending instructor code in `sessionStorage` if Google OAuth or email confirmation is used so it auto-claims on session activation!)

- [ ] **Step 1: Extend `RouteView` in `src/types/course.ts` and `#/admin` hash parsing in `src/state/useCourseStore.tsx`**

Parse `#/admin` <-> `{ kind: 'admin' }`. Do not overwrite `lastRouteHash` with `#/admin` so "Resume" on Overview still points to study lessons.

- [ ] **Step 2: Extend `src/state/useAuth.tsx` with `isAdmin` check and `claimInstructorAdmin(passcode)`**

On session load/change:
- If `sessionStorage.getItem('sat_1400_pending_instructor_code')` is present, call `supabase.rpc('claim_instructor_admin', { passcode })` and clear `sessionStorage`.
- Query `supabase.rpc('is_my_account_admin')` and set `isAdmin`.

- [ ] **Step 3: Add optional "Instructor / Admin Sign-Up" passcode toggle in `AuthPortal.tsx` and Account modal in `TopContextHeader.tsx`, plus `Instructor` navigation badge in `TopContextHeader.tsx` & `SidebarRail.tsx` when `isAdmin` is true**

- In `AuthPortal.tsx` (`Create Account` tab + Google OAuth when instructor toggle is checked): collapsible `"Signing up as the course instructor?"` input for Instructor Access Code.
- In `TopContextHeader.tsx` Account modal (when `!isAdmin`): collapsible `"Unlock Instructor View"` passcode input; when `isAdmin`: `"Instructor Admin"` badge + quick button to `#/admin`.
- In `SidebarRail.tsx`: show `"Instructor Cohort View"` item when `isAdmin` is true.

- [ ] **Step 4: Run `npx tsc -b` (with stub or Task 4 view) or proceed with Task 4 view before typecheck; keep Task 3+4 atomic if `App.tsx` switch requires `{ kind: 'admin' }`**

---

### Task 4: Read-Only Instructor Dashboard & Student Drill-Down View (`#/admin`)

**Files:**
- Create: `src/views/AdminDashboardView.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles/courseware.css`
- Modify: `README.md`

**Interfaces:**
- Consumes: `useAuth().isAdmin`, `buildStudentOverviewRecords` from `src/utils/adminAnalytics.ts`
- Produces: `<AdminDashboardView course={course} />` rendered at `{ kind: 'admin' }` in `src/App.tsx`

- [ ] **Step 1: Implement `src/views/AdminDashboardView.tsx` and styles in `src/styles/courseware.css`**

Include:
1. Access guard if `!user || !isAdmin` (clean editorial restricted notice with button to Sign In or return to Course Hub).
2. **Cohort Summary Strip:** Registered Students, Active in Last 7 Days, Average Steps Completed (`/70`), Cohort Practice Accuracy, plus `↻ Refresh Roster` button.
3. **Searchable & Sortable Student Roster Table:** Student name/email, Target Score, Steps (`/70`), Solved Qs (`/232`), R&W Acc %, Math Acc %, Mastered Vocab (`/60`), Error Log count + `3+` alert badge, Last Active timestamp, and `Inspect →`.
4. **Read-Only Student Drill-Down Panel:**
   - Day `01–07` progress bars (`steps / 10` & `solved Qs`)
   - Missed & Flagged Questions table (Question ID, Domain/Skill, Student Answer vs. Correct Answer, `[C]/[?]` Confidence tag)
   - Student `E1–E10` / `V1–V7` Error Log entries & Cold Re-Solve statuses
   - Student's written English Vocabulary Sentences & Custom Words
   - Student's Daily `15-Minute Reflection` entries (`Days 1–7`)

- [ ] **Step 2: Wire `{ kind: 'admin' }` in `src/App.tsx` and document Instructor Admin in `README.md`**

- [ ] **Step 3: Run full verification (`npm test` and `npm run build`)**

Run: `npm test && npm run build`
Expected: PASS (`0` errors, `0` warnings, security check confirming no plaintext passcode in `src/`).

- [ ] **Step 4: Commit Tasks 3 & 4**

```bash
git add -A
git commit -m "feat(admin): add Instructor Dashboard, student drill-down inspector, and admin signup flow"
```
