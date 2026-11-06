# @workspace/tooling

The repository's scripts, in TypeScript, run by Node directly (no build step, erasable syntax only).

- Every tool, who runs it and which settings it reads: [docs/technical/tooling/tools.md](../../docs/technical/tooling/tools.md).
- Layout: `src/<tool>/` holds the engine, `cli.ts` and `__tests__/`; `src/starter/<tool>/` holds tools that only fit this starter's architecture.
- This repository's app names, ports and paths live in the root `tooling.config.ts`, never in the tools.
