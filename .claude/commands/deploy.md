---
description: Run the production gate, push to main, and verify the live deployment.
---

Run PHASE 6 and PHASE 7 of the `ceo-orchestrator` pipeline:

1. `production-agent`: run the full pre-deployment gate (typecheck, build, database
   validation against the live Supabase project, environment validation, security
   audit). Report PRODUCTION READY: YES/NO with evidence. Do not proceed past a NO.
2. `vercel-deploy-agent`: once gated YES, get the verified commit onto `main` (this
   repo deploys via GitHub-triggered auto-build on push to `main` — see that agent's
   file for why a direct file-upload deploy is not used here) and confirm the
   resulting deployment reaches Ready with clean build logs.
3. `live-production-agent`: test the actual production URL per its checklist,
   substituting direct Supabase-tool verification for any step the sandbox's network
   policy blocks, and say explicitly whenever that substitution happens.

If anything fails at any step, diagnose, fix, push again, and re-verify — do not stop
on a reported failure if it is fixable. Do not merge/push to `main` if
production-agent's gate did not pass.

$ARGUMENTS
