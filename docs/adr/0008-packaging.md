# ADR 0008: Packaging as Standalone Binaries

## Status

Accepted

## Date

2026-07-13

## Context

Dev Doctor is a developer tool intended to run on any machine — including machines where Node.js is not installed. Distributing it as a Node.js package (`npm install -g devdoctor`) requires Node.js to be present, which defeats part of the purpose of a tool that diagnoses whether Node.js is working correctly.

Packaging as a standalone binary solves this: a single executable file contains both the application and the Node.js runtime.

## Options Considered

### Option A: `pkg` (original by Vercel)

The original pkg tool. Widely used, well-documented.

- **Cons**: Officially deprecated by Vercel in 2023. No longer maintained. Does not support Node.js 22+.

### Option B: `@yao-pkg/pkg`

A community-maintained fork of the original `pkg`. Actively maintained as of 2026, supports current Node.js LTS versions, drop-in replacement.

- **Pros**: Same API as original pkg. Minimal migration cost from existing pkg configurations. Good Windows support (important for this project).
- **Cons**: Community fork, not an official Vercel product.

### Option C: `caxa`

A newer packager that bundles the app and Node.js into a self-extracting archive.

- **Pros**: Simple, modern approach.
- **Cons**: Slower startup (extracts to temp directory on first run). Less mature Windows support.

### Option D: `bun build --compile`

Bun's built-in binary compiler.

- **Pros**: Very fast builds, single-file output, cross-compilation support.
- **Cons**: Requires Bun as a build dependency. The output binary uses the Bun runtime, not Node.js, which could cause subtle differences in behaviour. Adds a second runtime to the project's toolchain.

### Option E: `ncc` + shell wrapper

Use `@vercel/ncc` to bundle to a single JS file, then wrap with a small shell script or `caxa`-style self-extractor.

- **Pros**: Produces a single bundled JS file, easy to inspect.
- **Cons**: Still requires Node.js on the target machine. Not a true standalone binary.

## Decision

**Use `@yao-pkg/pkg` (Option B)** for Phase 8.

Build targets:

| Target | Output |
|--------|--------|
| `node22-win-x64` | `devdoctor-win.exe` |
| `node22-linux-x64` | `devdoctor-linux` |
| `node22-macos-x64` | `devdoctor-macos` |

## Build Configuration

`pkg` is configured via the `pkg` field in `package.json`:

```json
"pkg": {
  "scripts": "dist/**/*.js",
  "assets": [],
  "targets": ["node22-win-x64", "node22-linux-x64", "node22-macos-x64"],
  "outputPath": "binaries"
}
```

Build scripts added to `package.json`:

```json
"build:binary": "npm run build && pkg .",
"build:binary:win": "npm run build && pkg . --targets node22-win-x64",
"build:binary:linux": "npm run build && pkg . --targets node22-linux-x64",
"build:binary:macos": "npm run build && pkg . --targets node22-macos-x64"
```

## Plugin Loading in Packaged Binaries

As documented in ADR 0006, dynamic filesystem plugin discovery is skipped when running as a packaged binary. The built-in plugin manifest is compiled into the binary and is always available. External plugin support is a development-mode feature.

## Consequences

- `@yao-pkg/pkg` is added as a `devDependency`.
- The `binaries/` output directory is added to `.gitignore`.
- The compiled `dist/` directory must exist before packaging — `build:binary` runs `npm run build` first.
- `pkg` snapshots the `dist/` directory into the binary; `src/` TypeScript files are not included.

## Trade-offs

`@yao-pkg/pkg` produces larger binaries (~50–80 MB per target) because they embed the entire Node.js runtime. This is acceptable for a developer diagnostic tool that is downloaded once. The benefit — zero runtime dependencies on the target machine — outweighs the file size cost.
