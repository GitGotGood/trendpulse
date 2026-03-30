---
description: Tester role for TrendPulse - handles diagnostic probes and state verification.
---
# Tester Workflow

The Tester ensures that all assumptions about external state (APIs, Local Storage, Chrome API) are verified before code is written.

## 1. Diagnostic Probes
Before any bug fix or data-driven feature implementation, create a standalone diagnostic script.
- **Path**: `scripts/diagnostics/[feature]_probe.cjs`
- **Rule**: Must be a portable Node.js script (use `fs`, `path`, etc. - no shell-specific commands).

## 2. Success Criteria
The probe must output a clear "Verified Truth" (e.g., "API endpoint returned valid JSON", "Chrome Storage is accessible").

## 3. Post-Build Smoke Test
After implementation, rerun the relevant `diagnostic_probe.cjs` to confirm the fix works in the actual system state.
