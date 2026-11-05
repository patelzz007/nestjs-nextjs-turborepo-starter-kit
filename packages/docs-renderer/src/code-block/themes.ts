import type { CodeBlockThemes } from "@workspace/ui/components/code-block-highlight";

/**
 * The docs' code colours: GitHub Light for light code, One Dark Pro for dark
 * code — a warm charcoal rather than the near-black of GitHub Dark. Every
 * fence is highlighted with both at build time (`--cb-c` / `--cb-cd`), and
 * global.css ("Code block theme") gives dark code One Dark's own background
 * and chrome, whichever way the reader reached dark code (the site's dark
 * theme, or the code-theme toggle).
 */
export const DOCS_CODE_BLOCK_THEMES: CodeBlockThemes = { light: "github-light", dark: "one-dark-pro" };
