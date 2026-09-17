---
description: Verify the current live production deployment without redeploying anything.
---

Run the `live-production-agent` checklist against the current production URL
(`snooker-mvp` on Vercel, team `elbadaouihatimms-projects`) as-is — no code changes,
no redeploy. Pull current deployment status via the Vercel tools first
(`get_project` / `list_deployments` / `get_runtime_errors`) so the check reflects
what's actually live, then walk the browser/API checklist from that agent's file.

If a problem is found, report it with full evidence (URL, exact steps, console/network
output, or the direct-API-call substitute if the sandbox couldn't reach the host
directly) and propose the fix — but do not push a fix to `main` unless explicitly
asked to in this invocation, since this command is a read-only health check.

$ARGUMENTS
