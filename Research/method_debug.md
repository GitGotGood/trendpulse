Debugging Operating Method
Purpose

To make debugging systematic, efficient, and low-stress by using a repeatable workflow.
This method transforms debugging from random guesswork into a structured, evidence-based process.

Debugging Workflow (Scientific Method)

Always follow these seven steps when investigating a bug:

Reproduce

Ensure the bug can be triggered consistently.

Document inputs, environment, and steps to replicate.

Gather Context

Collect relevant information: logs, stack traces, metrics, user reports.

Use structured logging queries (trace IDs, timestamps, user IDs).

Isolate the Problem

Narrow down scope (e.g., binary search, commenting out sections, breakpoints).

Goal: identify the smallest piece of code that can still reproduce the issue.

Hypothesize Causes

Form one or more explanations.

Ask: “What flaw in my mental model would lead to this behavior?”

One common flaw in our development has been duplicate and sometimes competing redundant systems. Ensure this flaw is one of those under consideration.

Test Hypotheses

Run experiments: modify code, add logging, inspect variables.

Confirm or rule out each hypothesis systematically.

Implement Fix

Apply the minimal change that resolves the root cause.

Ensure no regressions are introduced.

Verify & Document

Re-run reproduction steps → bug must be gone.

Add regression tests if possible.

Write a short note in your developer journal and/or project docs:

Issue, root cause, fix, key lesson.

Mental Models to Use

Debugging = Mental Model Correction
The code does what you told it to, not what you think it should do. Treat debugging as finding where your understanding diverges.

Notional Machine
Build a shared “conceptual machine” for how your framework runs (event loops, async calls, DB transactions). Misunderstandings here cause subtle bugs.

Rubber Duck Debugging
Explain the code line-by-line out loud (or in notes). This forces assumptions to surface and often reveals the bug.

Logging Standards for Debugging

Always log in structured JSON with these keys:
level, timestamp, module, operation, message, trace_id

Use log levels consistently:

DEBUG → detailed steps (disabled in production)

INFO → normal flow (logins, purchases)

WARN → unexpected but handled conditions

ERROR → operation failed, app continues

FATAL → app must shut down

Each log must include context: user ID, entity ID, or request ID.

Ask: “What decision will this log help someone make later?”

Developer Journals (Debugging Notes)

Keep a lightweight daily log in Markdown or your preferred format:

Date: YYYY-MM-DD
Bug: [short description]
Reproduction steps:
What I tried:
What I learned:
Decision:
Next step:


Journals prevent rework and make future debugging faster.

Postmortems (For Serious Issues)

After any major outage or production bug:

Summary of what happened

Timeline with timestamps

Root cause (5 Whys method)

What went well

What could be improved

Action items (assigned & tracked)

Must be blameless: focus on system/process fixes, not individuals.

Team Rituals

Log Hygiene Review: once per sprint, spend 30 min reviewing logs for clarity and noise.

TODO Review: check and clean up TODOs, convert stale ones into tickets.

Retros Debug Reflection: in sprint retro, ask: “What logging or doc would have made this 10x easier?”

Success Metrics

Track these over time to see if debugging is improving:

MTTR (Mean Time to Recovery)

Rework Rate (code rewritten shortly after merge)

Onboarding Time (time for a new dev to fix their first bug)

Cycle Time (commit → deploy)

## 🎯 Slime Collector Specific Tips

### **Common Debug Patterns**
- **State Management Issues**: Check `profile.celebratedTiers` vs `recentTierAchievements`
- **Progression Logic**: Verify `getBiomeTier` vs `getBiomeTierProgress` consistency
- **Unlock Logic**: Check `isUnlocked` functions in WorldMap vs progression
- **Visual Issues**: Use browser dev tools to inspect CSS positioning

### **Quick Debug Commands**
```bash
# Check console logs
npm run dev
# Open browser dev tools → Console tab

# Build and test
npm run build
npm run preview

# Check for linting errors
npm run lint
```

### **State Debugging Checklist**
- [ ] **New Profile**: Does it work with a fresh profile?
- [ ] **Existing Profile**: Does it work with saved progress?
- [ ] **State Transitions**: Do state changes persist correctly?
- [ ] **Edge Cases**: What happens at boundaries (0, 20, 40, 60 answers)?

### **Visual Debugging Checklist**
- [ ] **CSS Positioning**: Use `position: relative` and `left: X%` instead of pixel adjustments
- [ ] **Element Inspection**: Right-click → Inspect Element to see actual CSS
- [ ] **Layout Math**: Calculate positions as percentages of container width
- [ ] **Responsive Test**: Check on different screen sizes

### **Red Flags to Watch For**
- ❌ **Multiple Sources of Truth**: Same data calculated in different places
- ❌ **State Confusion**: Temporary state vs persistent state mixed up
- ❌ **Visual Loops**: Making tiny adjustments repeatedly instead of calculating
- ❌ **Assumption Debugging**: Guessing instead of using console logs

### **Debug Tools**
- **Console Logs**: Add `console.log()` with structured data
- **Browser Dev Tools**: Inspect elements, check CSS, view console
- **Profile Inspector**: Check `profile` object in console
- **State Tracker**: Log state changes with timestamps