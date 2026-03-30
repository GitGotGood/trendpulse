# Coding Workflow v3 (Stability & Idempotency)
Agent Orchestration + High-Confidence Engineering Patterns

## Objective

Build upon the v2 multi-agent protocol by adding **Engineering Safety Rails** that prevent common runtime errors, session drift, and environmental flakes.

---

## 1) High-Confidence Engineering Patterns

### 1.1 Platform Boundary Management
Agents must identify potential environment conflicts (e.g., Edge vs Node) before implementation.
- **Rule**: If a system spans multiple runtimes (Next.js Middleware vs Server), configuration **MUST** be split into `[feature].config.ts` (universal) and `[feature].ts` (platform-specific).
- **Goal**: prevent "Module not found (fs)" or similar build-time/runtime errors.

### 1.2 Idempotent Development Seeding (The "Alice" Rule)
Wiping and re-seeding the database must not break the user's active browser session.
- **Rule**: All development seed scripts **MUST** use fixed, human-readable primary keys (e.g., `user_alice_123`) instead of random UUIDs.
- **Goal**: Prevent "Ghost Sessions" and unauthorized redirects after database resets.

### 1.3 Mandatory Diagnostic Probes
Before implementing a fix for data-driven errors (like broken links or DB inconsistencies), agents must write a standalone diagnostic script.
- **Rule**: Create a portable script in `scripts/diagnostics/*.cjs` to verify assumptions.
- **Contract**: The script must be Node.js-based (avoid shell-specific commands like `grep` or `bash` for Windows compatibility).
- **Goal**: Provide "Verified Truth" before executing large-scale changes.

### 1.4 Safe-Component Wrappers (The "Robust UI" Pattern)
Any component rendering external or "untrusted" data must handle failure gracefully.
- **Rule**: External images or API payloads must be wrapped in a **Client Component Wrapper** with `onError` or `try/catch` fallbacks.
- **Goal**: Prevent an entire page from crashing due to a single 404 or malformed JSON object.

---

## 2) Updated Protocol (v3)

### 2.1 Pre-Flight Check
The **Supervisor** or **Planner** must now include a `boundary_check` artifact if the project uses multiple runtimes (Edge, Node, Serverless).

### 2.2 Artifact: `diagnostic_probe.cjs`
When a bug is reported that involves external state (DB, APIs, CDN), the **Tester** must produce a `diagnostic_probe.cjs` and its output as a prerequisite for the **Builder**.

### 2.3 Post-Build "Smoke" Verification
The **Reviewer** must not only review code but also run the relevant `diagnostic_probe.cjs` to confirm the fix against the actual system state.

---

## 3) Summary of Workflow Evolution
- **v1**: Basic coordination.
- **v2**: Protocol-driven with Trace folders and Error Packets.
- **v3**: Technical durability via Boundary-Awareness and Stable Seeding.
