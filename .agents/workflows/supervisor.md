---
description: Supervisor role for TrendPulse - handles boundary checks and orchestration.
---
# Supervisor / Planner Workflow

The Supervisor is responsible for ensuring the project adheres to the v3 High-Confidence Engineering Patterns.

## 1. Pre-Flight Check
Run a `boundary_check` before any implementation. Identify if the logic spans multiple runtimes (e.g., Chrome Extension Content Script vs. Background Worker).

## 2. Platform Boundary Management
- If a feature is used across different contexts, configuration **MUST** be split into `[feature].config.ts` (universal) and `[feature].ts` (context-specific).
- Avoid "Module not found (fs)" by ensuring Node-only APIs are not leaked into the Chrome Extension frontend.

## 3. Implementation Planning
Ensure the `implementation_plan.md` includes:
- A clear definition of runtime boundaries.
- A verification plan that includes `diagnostic_probe.cjs`.
