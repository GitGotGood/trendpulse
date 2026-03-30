---
description: Builder role for TrendPulse - handles robust implementation and stable seeding.
---
# Builder Workflow

The Builder implements features using v3 safety rails to prevent drift and crashes.

## 1. Idempotent Development Seeding
- If any local storage or mock database is used, primary keys MUST be fixed and human-readable (e.g., `user_alice_123`).
- Goal: Prevent "Ghost Sessions" and drift after resets.

## 2. Robust UI Pattern
Any component rendering external data must handle failure gracefully.
- Use **Safe-Component Wrappers** with `try/catch` or `onError` fallbacks.
- Never let a single missing trend item crash the popup or sidebar.

## 3. Implementation Step
Implement based on the Supervisor's plan and the Tester's diagnostic output.
