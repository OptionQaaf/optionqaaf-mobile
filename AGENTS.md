## 1. Agent Mission & Scope

### Mission

- Deliver **correct, minimal, and maintainable changes** that strictly align with existing architecture, conventions,
  and patterns.
- **Preserve existing behavior by default** unless behavior change is explicitly requested.
- Provide **clear, verifiable explanations** for every change made.

The agent exists to **assist**, not redesign.

---

### Allowed

- Implement explicitly requested features or fixes using **existing patterns only**.
- Refactor **only when required** to safely complete the request and with explicit justification.
- Add tests **only when they directly validate the requested change** or prevent regression caused by the change.

---

### Not Allowed

- Introducing new dependencies without explicit request or necessity.
- Changing architecture, frameworks, tooling, or folder structure.
- Editing `node_modules`, generated files, or lockfiles unless explicitly required.
- Guessing APIs, framework behavior, environment variables, or configuration.
- “Improving” code that is unrelated to the request.

---

### Definition of Success

A change is successful only if:

- The codebase behaves exactly as expected for the requested change.
- The diff is **minimal, localized, and consistent** with existing patterns.
- All changes are **explained, justified, and verifiable**.
- Any uncertainty or risk is explicitly disclosed.

---

## 2. Repository Understanding Protocol (MANDATORY)

**This protocol must be completed before writing, editing, or deleting any code.**

### Pre-flight Checklist

1. **Scan top-level structure** to identify major domains (`app`, `src`, `features`, `ui`, `store`, etc.).
2. **Identify architectural layers** (UI, feature logic, domain logic, shared utilities).
3. **Locate configuration and tooling**:
   - `package.json`
   - `tsconfig.json`
   - `eslint.config.js`
   - `metro.config.js`
   - `tailwind.config.js`

4. **Identify naming conventions** for files, folders, components, and hooks in the relevant area.
5. **Locate existing patterns** for:
   - State management
   - Data fetching
   - Navigation
   - Styling

6. **Check for `AGENTS.md` or `agents.md` in subdirectories** and apply stricter local rules if present.

### Hard Stop Rule

If any of the above cannot be completed **with confidence and evidence**, the agent must:

- Stop
- Report what is missing
- Ask for clarification

**Proceeding by assumption is forbidden.**

---

## 3. Architectural Invariants (NON-NEGOTIABLE)

These constraints must never be violated.

- **Layer boundaries must be preserved**
  - UI components must not contain domain or business logic.
  - Shared utilities must remain framework-agnostic unless already coupled by design.

- **Dependency direction is one-way**
  - Higher-level layers may depend on lower-level layers.
  - Lower-level layers must never depend on higher-level layers.

- **State ownership is fixed**
  - State must remain in its original layer unless explicitly required by the request.

- **No cross-layer leakage**
  - App-level modules must not be imported into shared utilities.

If a requested change would violate an invariant, the agent must stop and report.

---

## 4. Coding Standards for Agents

### File Structure & Naming

- Follow **existing naming and folder conventions exactly**.
- Do not introduce new organizational schemes.
- New files must live alongside their closest related feature.

---

### Functions & Components

- Single responsibility per function or component.
- Prefer early returns over deep nesting.
- Avoid hidden side effects.
- **Functional React components only.**

---

### Types & Safety

- All exported functions, components, and hooks must have explicit types.
- `any` is forbidden unless it already exists in surrounding code and cannot be removed safely.

---

### Side Effects & Error Handling

- Side effects must be:
  - Localized
  - Predictable
  - Easy to reason about

- Errors must be handled in the layer where they occur.
- Do not swallow errors silently.

---

### Formatting & Style

- Follow repository ESLint and Prettier rules.
- Do not reformat unrelated code.
- Formatting changes must never be bundled with behavioral changes.

---

### Dead Code & TODOs

- Do not introduce commented-out code.
- Do not add TODOs unless explicitly requested.

---

## 5. Change Strategy & Incrementalism

Agents must:

- Prefer **minimal diffs**.
- Touch the **fewest files possible**.
- Avoid “drive-by refactors”.
- Keep refactors and behavior changes logically separable.

### Explicit Anti-Patterns

- “While I’m here” changes
- Broad renames
- Formatting churn
- Introducing helpers or abstractions without necessity

---

## 6. Refactoring Rules (HIGH IMPORTANCE)

### Refactoring is Allowed Only If

- It is **required** to safely implement the requested change.
- Existing structure actively blocks or complicates the change.

### Refactoring is Forbidden If

- It only improves aesthetics, style, or perceived cleanliness.
- It reorganizes code without functional necessity.

### Required Before Any Refactor

1. State **why** the refactor is required.
2. Explain **how behavior is preserved** (tests or explicit reasoning).
3. Keep the refactor **local and minimal**.

If behavior preservation cannot be proven, the refactor must not proceed.

---

## 7. Agent Decision-Making Heuristics

- Prefer **local consistency** over theoretical correctness.
- If multiple solutions exist, choose the smallest valid change.
- If uncertainty is high, stop and ask.
- If assumptions are required, list them explicitly.

**Silence implies certainty — never stay silent when uncertain.**

---

## 8. Safety & Hallucination Prevention

Agents must never:

- Invent APIs, configs, env vars, or framework versions.
- Assume undocumented behavior.
- Introduce abstractions “for future use”.

Agents must always:

- Point to existing code when reusing patterns.
- Verify that every import, call, and config already exists.

---

## 9. Communication & Output Rules

All responses must include:

- A clear summary of changes (bullet points).
- File paths and affected areas.
- Explicit assumptions (if any).
- Disclosure if tests were not run and why.

Avoid vague language such as:

- “Improved logic”
- “Cleaned up code”
- “Refactored for clarity”

---

## 10. Anti-Patterns (STOP CONDITIONS)

Stop immediately if you are about to:

- Add dependencies without explicit request.
- Alter architecture or folder structure.
- Modify unrelated files.
- Add TODOs or commented-out code.
- Assume environment variables or configs.
- Introduce global state unnecessarily.
- Proceed without understanding existing patterns.

---

## 11. Agent Self-Check (MANDATORY)

Before finalizing any response, the agent must verify:

- Did I change only what was requested?
- Can I explain every change with evidence?
- Did I preserve behavior?
- Did I avoid assumptions?
- Would a senior engineer accept this diff?

If any answer is “no”, stop and revise.
