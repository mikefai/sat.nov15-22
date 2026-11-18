# Single-Instructor Admin Sign-Up & Student Progress Inspector — Design Spec

- **Date:** 2026-11-18
- **Status:** Approved by user

## 1. Intent & Why
Enable the sole course instructor (`mikeperac@gmail.com`) to sign up or sign in and inspect every student's live progress across the Digital SAT 1400+ Interactive Courseware without exposing any student's data to other students.

## 2. Goals, Non-Goals & Anti-Goals
- **Goals:**
  - Automatically grant Instructor Admin status to `mikeperac@gmail.com` upon Google or Email sign-up/sign-in.
  - Provide an optional `"Instructor Sign-Up"` passcode path on the sign-up and account forms, verified server-side against a bcrypt hash (`pgcrypto`) in a private Postgres schema, in case the instructor signs in with a secondary email.
  - Let the authenticated admin read all `public.profiles` and `public.course_progress` rows via Postgres Row-Level Security (`SELECT` only).
  - Render an **Instructor Dashboard** (`#/admin`) showing cohort summary metrics, a searchable/sortable student roster, and a read-only per-student drill-down inspector (Day `1–7` step completion, practice accuracy & missed/flagged R&W + Math items, `E1–E10`/`V1–V7` Error Log entries, vocabulary mastery & written sentences, and daily reflections).
- **Non-Goals:**
  - Multi-tutor role hierarchies, student cohort groups, or admin mutation of student answers.
- **Anti-Goals (Failures Even If Technically Working):**
  - Storing admin privileges in client-editable `raw_user_meta_data` / `user_metadata`.
  - Shipping any plaintext admin passcode in frontend JavaScript bundles.
  - Allowing an admin view to accidentally trigger `useCourseStore` auto-save against a student's `course_progress` row.

## 3. Approaches Considered
1. **Database-Locked Admin Tables + `SECURITY DEFINER` Check in RLS (`Selected`):**
   - Private `private.admin_emails`, `private.admin_users`, and `private.admin_passcode_config` tables (unexposed via Data API), paired with zero-arg `public.is_my_account_admin()` and `public.claim_instructor_admin(passcode text)` RPCs executable only by `authenticated`.
   - RLS `SELECT` policies on `public.profiles` and `public.course_progress` allow `(select auth.uid()) = user_id OR (select public.is_my_account_admin())`.
2. **`user_metadata` Role Flag (`Rejected`):** Unsafe; students can mutate `user_metadata` via `supabase.auth.updateUser`.
3. **Separate Supabase Edge Function Admin API (`Rejected`):** Unnecessary moving parts and cold-start latency when Postgres RLS enforces read-only cohort queries natively.

## 4. Architecture & Builder Decisions
- **Default Initial Instructor Access Code (hashed via `pgcrypto` `bf`):** `SAT1400-INSTRUCTOR-2026` (rotatable directly in SQL).
- **Read-Only Isolation:** `AdminDashboardView.tsx` fetches student rows directly from `supabase.from('profiles')` + `supabase.from('course_progress')` into component-local state, completely separate from `useCourseStore` so student data is never overwritten.
