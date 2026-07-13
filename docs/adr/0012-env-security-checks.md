# ADR 0012 — Environment Security Risk Detection

**Date:** 2026-07-13  
**Status:** Accepted

---

## Context

The `devdoctor env` command displays and validates environment variables but does not flag
common security misconfigurations that are present on many developer machines:

1. **`.` (current directory) in PATH** — A well-known privilege escalation and supply-chain
   attack vector. If `.` is in PATH (especially early in the list), running a command like
   `ls` in a directory containing a malicious executable named `ls` would execute it instead
   of the system binary.

2. **World-writable PATH entries** — A PATH directory that is writable by non-privileged
   users allows an attacker to plant executables that shadow system binaries.

3. **Secrets accidentally in environment variables** — API keys, tokens, and passwords are
   frequently set as environment variables during development and occasionally committed
   to shell profiles (`.bashrc`, `.zshrc`, etc.) or CI configuration. Common patterns
   include variables named `*_TOKEN`, `*_SECRET`, `*_KEY`, `*_PASSWORD`, `*_API_KEY`
   with values that look like tokens (long alphanumeric strings, base64, JWT patterns).

These checks are informational — they are warnings that help developers understand the
security posture of their machine, not failures that indicate a broken environment.

---

## Decision

The `env-scanner.ts` is extended to return a `securityRisks` array as part of
`EnvironmentInfo`. Each risk has:

```typescript
interface EnvSecurityRisk {
  severity: 'warn' | 'fail';
  category: 'path' | 'secret';
  title: string;
  detail: string;
  suggestion: string;
}
```

Three detectors are implemented:

### 1. `.` in PATH detector

Scans PATH entries for literal `.` or the empty-string entry (which also resolves to the
current directory). Reports severity `fail` because this is an active security risk.

### 2. Suspicious secret variable detector

Scans all environment variable names against the pattern:
`/(TOKEN|SECRET|KEY|PASSWORD|API_KEY|CREDENTIAL|AUTH)$/i`

For matching variables, the value is checked for token-like patterns:
- Length > 16 characters
- High entropy (mostly alphanumeric with possible `-`, `_`, `.`)
- Not a well-known non-secret value (e.g., `development`, `production`, `true`)

The variable *name* is reported in the warning but the *value* is never included in any
output — only a masked summary (e.g., `"Value is 40 characters, looks like a token"`).

### 3. World-writable PATH entry detector (Unix only)

On Unix systems, PATH entries are checked with `fs.statSync().mode & 0o002` to detect
world-writable directories. Reports severity `warn`.

The `env.ts` command renders a new **Security Risks** section below the PATH breakdown
when any risks are detected. The section is skipped entirely if no risks are found,
keeping the output clean for healthy environments.

---

## Consequences

- **Positive:** Developers are made aware of common security misconfigurations that are
  easy to overlook.
- **Positive:** Secret detection is conservative — it only flags variables whose names
  match a known pattern AND whose values look like tokens. False positives are possible
  but minimized by the dual name+value check.
- **Positive:** Values are never echoed in output, only the variable name and a
  characterization of the value, reducing the risk that the tool itself leaks secrets.
- **Neutral:** World-writable check is Unix-only because Windows ACL semantics are
  fundamentally different and cannot be reliably assessed via `fs.stat()` mode bits.
- **Trade-off:** The secret heuristic will miss secrets with non-standard naming
  conventions and will flag some non-secrets (e.g., a `BUILD_KEY` that contains a
  non-sensitive build identifier). Framing the output as a suggestion rather than an
  error mitigates the impact of false positives.
