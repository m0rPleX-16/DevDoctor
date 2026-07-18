# ADR 0022 — Plugin Categorization, Smart Detection, and PHP Plugin

**Date:** 2026-07-18  
**Status:** Accepted

---

## Context

As Dev Doctor grew to 13 built-in plugins spanning different technology types (languages, frameworks, databases, tools), three problems became increasingly apparent:

1.  **Flat plugin lists don't scale.** The `--help` output, the `devdoctor doctor` report, and the interactive plugin picker all presented plugins as a single flat list. With 13+ entries, users could not quickly locate the plugin they needed. Frameworks like Next.js and Express were intermixed with languages like Java and C++, and infrastructure tools like Git.

2.  **No workspace awareness.** Users had to know which plugins were relevant to their project and invoke them by name. Dev Doctor had no mechanism to automatically detect what technologies were present in the current directory and surface them proactively.

3.  **PHP was missing.** The project already included a Laravel plugin, but PHP itself — the underlying runtime — had no dedicated diagnostic coverage. Users diagnosing a Laravel project had no way to verify that their PHP binary, Composer package manager, and `php.ini` configuration were healthy.

---

## Decisions

### 1. Add a Required `category` Field to the Plugin Interface

The [`Plugin`](file:///c:/Code%20Practice/DevDoctor/src/core/types/plugin.ts) interface now requires a `category` property typed as the union `'language' | 'framework' | 'database' | 'tool'`. This is a **breaking change** to the plugin contract — all existing and third-party plugins must declare a category.

We chose a required field (not optional) because:
*   Every plugin logically belongs to exactly one category. There is no meaningful "uncategorized" case.
*   Making it required ensures the runtime type guard [`isPlugin()`](file:///c:/Code%20Practice/DevDoctor/src/infra/plugins/plugin-loader.ts) catches invalid dynamic plugins at load time rather than silently falling back.
*   The [plugin contract test harness](file:///c:/Code%20Practice/DevDoctor/src/plugins/plugin-contract.test.ts) (ADR-0013) now asserts that `category` is one of the four valid values for every built-in plugin.

We chose a string literal union over an enum because:
*   Enums in TypeScript emit runtime code; a union is erased at compile time and simpler for a metadata tag.
*   Dynamic plugins loaded via `import()` (ADR-0006) return plain objects — string comparison is more natural than importing and matching against an enum value.

Current category assignments:

| Category | Plugins |
|---|---|
| `language` | `node`, `python`, `java`, `cpp`, `csharp`, `php` |
| `framework` | `nextjs`, `django`, `laravel`, `express`, `fastapi` |
| `database` | `mysql`, `redis` |
| `tool` | `git` |

### 2. Surface Categories in All CLI Output

Categories are used to visually group plugins in three places:

*   **`devdoctor --help`**: The "Available Plugins" section is now split into bold-titled subsections (Languages, Frameworks, Databases, Tools & Utilities) instead of a flat alphabetical list.
*   **`devdoctor doctor`**: The health report groups diagnostic results by category within each project-context section ("Detected in this project" and "Other plugins").
*   **Interactive plugin pickers** (`diagnose`, `fix`, `rollback`): The numbered selection menu organizes choices under category headers, making it easier to locate a specific plugin when the list is long.

The rendering order is fixed: languages → frameworks → databases → tools. This mirrors the natural dependency hierarchy (you need a language before you can use its frameworks).

### 3. Smart Project Detection at Interactive Startup

When `devdoctor` is launched without arguments (entering the interactive menu loop), the CLI now calls [`detectProjectContext()`](file:///c:/Code%20Practice/DevDoctor/src/infra/system/project-detector.ts) on every menu render cycle and prints the result directly below the ASCII banner:

```
  🔍  Detected in this directory: Node.js, Express, Git
```

If no plugins match, a neutral message is shown instead. This gives users immediate context about which diagnostics are most relevant without requiring them to run `devdoctor doctor` first.

We chose to run detection on every render (not just once at startup) because the user might change directories between menu cycles in a multi-terminal workflow. The detection is fast — it reads directory listings into a cached `Set<string>` and performs in-memory lookups.

### 4. Add a PHP Plugin

A new [`PhpPlugin`](file:///c:/Code%20Practice/DevDoctor/src/plugins/php/index.ts) provides three dependency-aware diagnostic checks:

| Check | Name | Depends On |
|---|---|---|
| PHP binary installed, version ≥ 8.1 | `php-installation` | — |
| Composer package manager available | `composer-version` | `php-installation` |
| Active `php.ini` configuration file loaded | `php-ini` | `php-installation` |

The version check warns (rather than fails) for PHP < 8.1, since older versions are functional but end-of-life. The Composer and `php.ini` checks depend on `php-installation` and skip cleanly via `applyDependencySkips()` (ADR-0017) when PHP is not found.

**No automated repair** is provided. PHP installation and configuration management varies significantly across platforms (Homebrew, apt, XAMPP, Windows installers, Docker images) and carries risk of breaking existing web server configurations. This follows the same rationale as the Redis and Python plugins (ADR-0018): the `suggestion` field provides platform-specific guidance without Dev Doctor executing it.

Project markers: `composer.json`, `composer.lock`, `php.ini`, `*.php`. Note that `composer.json` overlaps with the Laravel plugin's markers — this is intentional, as both plugins are relevant when Composer files are present. The Laravel plugin additionally requires `artisan`.

---

## Consequences

**Positive:**
*   14 plugins now cover a comprehensive development stack. The PHP plugin closes the gap where Laravel diagnostics existed without underlying runtime checks.
*   Category grouping makes CLI output scannable at a glance. Users working with 2-3 technologies can quickly locate their plugins instead of reading through a 14-item flat list.
*   Smart detection provides zero-configuration value — new users see relevant plugins highlighted immediately without needing to read documentation.
*   The `category` field establishes a foundation for future features: category-specific repair strategies, filtered `doctor` runs (`devdoctor doctor --category framework`), and plugin marketplace taxonomy.

**Negative / Trade-offs:**
*   Adding `category` to the `Plugin` interface is a breaking change for any third-party dynamic plugins (ADR-0006). They will fail the `isPlugin()` type guard until updated. This is acceptable since dynamic plugin loading is not yet public-facing.
*   The fixed category order (languages → frameworks → databases → tools) is opinionated. Some users might prefer alphabetical or relevance-based ordering. We chose a stable, predictable layout over a configurable one for simplicity.
*   Smart detection runs `detectProjectContext()` on every interactive menu render. While the implementation caches directory reads and is sub-millisecond in practice, it does perform filesystem I/O that is technically unnecessary if the user hasn't changed directories.
*   The 297-test suite now takes ~17 seconds to run, up from ~14 seconds, due to the added PHP plugin contract test which spawns real subprocesses. This is within acceptable bounds for a full test run.
