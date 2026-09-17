---
description: Run the verification phase only (database, security, code, integration audits) without implementing anything new.
---

Run PHASE 4 (VERIFY) of the `ceo-orchestrator` pipeline against the current state of
the repository and the live Supabase project — no new feature work, just audits:

- `database-agent`: schema/RLS/query consistency against `components/SettingsModal.tsx`
  and the live project via the Supabase tools
- `security-audit-agent`: auth, secrets, RLS, exposure
- `code-audit-agent`: correctness, dead code, race conditions, maintainability
- `integration-agent`: trace that UI features are actually wired end-to-end

Report each as PASS/FAIL with evidence, per that agent's OUTPUT format. If
`$ARGUMENTS` names a specific area (e.g. "payment status", "table pricing", "auth"),
scope all four audits to that area; otherwise audit the whole app.

Any CRITICAL or HIGH finding should be fixed and retested per the ceo-orchestrator's
PHASE 5 rule (diagnose → fix → retest → regression), not merely reported, unless the
fix is architecturally significant enough to need your sign-off first.

$ARGUMENTS
