# Installing this rule set into your repo

Copy into the ROOT of your monorepo. Merge with your existing AGENTS.md: keep any repo-specific
content, and keep the "Completion gate" section, the routing table, and the rules/ references.

  AGENTS.md                              universal entry point (Codex, Cursor, Copilot, Windsurf, Gemini CLI, ...)
  rules/00 ... rules/26                  the detailed rule set (load only what the task needs)
  CLAUDE.md                              one line: "@AGENTS.md"  (Claude Code reads CLAUDE.md, not AGENTS.md)
  .cursor/rules/00-project-router.mdc    Cursor always-apply pointer (includes the completion gate)
  .github/copilot-instructions.md        GitHub Copilot pointer (includes the completion gate)

Your existing .cursorrules can stay as a legacy fallback, but should also say:
"Read AGENTS.md and rules/ first, and run the completion gate before finishing."
Your .claude/skills and .agents/skills folders are a different mechanism (invokable skills) and are unaffected.

## Make the completion gate real (do these once)

1. Root package.json scripts: "lint": "turbo run lint", "test": "turbo run test".
2. Every package: "lint": "eslint . --max-warnings=0" and "test": "vitest run".
3. Put the ESLint config from rules/13-ci-cd-and-quality-gates.md ("Reference ESLint configuration") in your shared
   eslint-config package. The canary test in the same file proves the config is actually catching violations.
4. Add a pre-push hook running `pnpm run lint && pnpm run test`, and make the CI `verify` job a required check.
5. Optional: a tool-level hook (e.g. Claude Code hooks) that blocks finishing until the gate passes. Check that
   tool's current docs for the configuration.

Prompts ask an agent to run the gate. Steps 3-4 are what actually enforce it.
