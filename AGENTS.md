<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- "Ver como aluno": instructor keeps own auth session; server-side `student_view_sessions` + `start/get/end_student_view` RPCs authorize, and trigger `zz_student_view_guard` (on every public table) + restrictive storage policies block all writes while a session exists — new public tables must get the same trigger. Why: frontend locks are not a guarantee.
- Report blocks store their configurable fields in `section.reportFields` (absent = classic fixed template), never in `items`; field keys are stable and removed fields keep their saved answers. Why: keeps Relatório independent from Perguntas and protects legacy submissions.
- Café Central task writes: authorization, column guard (`cafe_task_update_violation` via trigger) and mission lock (`cafe_task_write_open`) live in the database; UI only mirrors them. Why: direct API calls must not bypass the rules.
- Indicator consolidation (moda): `src/lib/indicator-consolidation.ts` only computes a preview; teacher decisions live in append-only `indicator_homologations` (trigger-guarded, one `is_current` per student×indicator) and are never overwritten automatically; every definitive mission evaluation calls RPC `consolidate_evaluation` (DB-side mode per student×indicator, one vote per mission) instead of writing the matrix directly; bulk batches that first snapshot every row into `indicator_consolidation_snapshots` (restore point) and skip ties, A-reductions and homologated cells. Why: protects existing pedagogical records.
- Pedagogical analysis (IndicatorDialog): server fn `analyzeIndicatorHistory` re-checks instructor/enrollment/UC10/student-view and loads evidence server-side; AI output is suggestion-only, sources filtered to real missions, never writes to DB. Why: AI must not bypass the evaluation flow.
