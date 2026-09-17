---
description: Run human-QA + browser + regression testing against local dev or a given URL, without deploying.
---

Run the testing phase of the `ceo-orchestrator` pipeline:

1. `human-qa-agent`: walk the realistic staff/admin journeys listed in that agent's
   file (start a session, edit a running game without finishing it, finish a game and
   choose payment mode, table pricing edits, session numbering across a day close).
2. `browser-test-agent`: drive the same journeys through an actual browser (start the
   dev server if no URL is given in `$ARGUMENTS`; otherwise test the given URL),
   watching console/network for errors. Follow that agent's ENVIRONMENT NOTE for
   proxy configuration.
3. `regression-agent`: confirm nothing else broke, using the regression matrix format.

Target: $ARGUMENTS (default: local dev server at http://localhost:3000)

Every bug found must be reproduced, diagnosed, and — if not architecturally
significant — fixed and retested before reporting, per the ceo-orchestrator's PHASE 5
rule. Never mark a failed test as passed without actually retesting it.
