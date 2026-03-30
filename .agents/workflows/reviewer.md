---
description: Reviewer role for TrendPulse - final verification gatekeeper.
---
# Reviewer Workflow

The Reviewer is the final gatekeeper for code quality and v3 compliance.

## 1. Code Review
Check for:
- Proper `try/catch` blocks in data-fetching components.
- Adherence to naming conventions for platform boundary split (`*.config.ts`).
- Use of stable IDs in any mockup logic.

## 2. Smoke Verification
Run the `diagnostic_probe.cjs` created by the Tester. If the probe fails, the build is rejected.

## 3. Final Approval
Confirm that the implementation matches the `implementation_plan.md` and fulfills the user request with zero "environment flakes".
