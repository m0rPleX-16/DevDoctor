# ADR 0013: Plugin Contract Testing Strategy

## Status
Accepted

## Context
As DevDoctor grows, the number of plugins (both built-in and dynamically loaded) will increase. Each plugin must strictly adhere to the `Plugin` interface and return structurally valid `DiagnosticResult`, `RepairResult`, and `VerificationResult` objects. Relying solely on manual testing or isolated unit tests for each plugin leads to duplicated test boilerplate and risks interface drift, where a plugin might return a malformed result that breaks the CLI rendering engine.

## Decision
We have introduced a generic "Plugin Contract Test" suite (`testPluginContract`) that automatically validates any given `Plugin` instance against the expected interface invariants. 

All built-in plugins (e.g., `NodePlugin`, `MysqlPlugin`, `GitPlugin`) MUST be passed through this contract test suite.

## Consequences

### Positive
- **Guaranteed Consistency:** The CLI rendering layer can trust that any plugin that passes the contract test will yield a correctly formatted result, preventing runtime crashes.
- **Reduced Boilerplate:** Developers adding new plugins do not need to write repetitive tests to assert the basic shape of their results. They get structural validation "for free" just by adding `testPluginContract(new MyPlugin())`.
- **Easy Updates:** If the `Plugin` interface evolves, we update the contract test once, and all plugins are instantly verified against the new requirements.

### Negative
- Testing the contract invokes the `diagnose()`, `repair()`, and `verify()` methods. Because the test currently runs against real implementations without mocking the underlying OS commands, it assumes the commands can be run safely. (The test currently passes `non-existent-check` to `repair` and `verify` to avoid side effects). If a plugin's `diagnose()` method has severe side effects (which it shouldn't, per architectural rules), running the contract test could be risky.
