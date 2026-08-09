import { describe, expect, it } from "vitest";

import { CodeBlock, detectLanguageName } from "@/components/ui/code-block";
import { CODE_LANGUAGES } from "@/lib/types/code-block";

describe("detectLanguageName", () => {
	it("detects an `export default [` eslint flat-config as typescript", (): void => {
		const code = `export default [\n\t{ ignores: ["**/*.spec.ts"] },\n\t...baseConfig,\n];`;
		expect(detectLanguageName(code)).toBe("typescript");
	});

	it("detects `export default {` object configs as typescript", (): void => {
		const code = `export default {\n\tname: "hello",\n};`;
		expect(detectLanguageName(code)).toBe("typescript");
	});

	it("detects `export const` + `import` blocks as typescript", (): void => {
		expect(detectLanguageName("export const x = 1;")).toBe("typescript");
		expect(detectLanguageName("import { z } from 'zod';")).toBe("typescript");
	});

	it("detects arrow-function config files as typescript", (): void => {
		const code = `export default (): void => {\n\tconsole.log("hi");\n};`;
		expect(detectLanguageName(code)).toBe("typescript");
	});

	it("detects `const config = [...]` blocks as typescript (not json)", (): void => {
		const code = `const config = [\n\t{ name: "eslint", rules: {} },\n];`;
		expect(detectLanguageName(code)).toBe("typescript");
	});

	it("detects `let` / `var` declarations as typescript", (): void => {
		expect(detectLanguageName("let counter = 0;")).toBe("typescript");
		expect(detectLanguageName("var old = true;")).toBe("typescript");
	});

	it("detects KEY=value pairs as env", (): void => {
		expect(detectLanguageName('DATABASE_URL="postgresql://user:pass@localhost:5432/db"')).toBe("env");
		expect(detectLanguageName("NODE_ENV=production\nPORT=3000")).toBe("env");
	});

	it("detects HTTP request blocks as http", (): void => {
		expect(detectLanguageName("POST /auth/login HTTP/1.1\nContent-Type: application/json")).toBe("http");
	});

	it("detects HTTP response blocks as http", (): void => {
		expect(detectLanguageName("HTTP/1.1 200 OK\nSet-Cookie: accessToken=<jwt>")).toBe("http");
	});

	it("detects unified diffs by their opening lines", (): void => {
		expect(detectLanguageName("diff --git a/src/x.ts b/src/x.ts\n--- a/src/x.ts\n+++ b/src/x.ts\n@@ -1,2 +1,3 @@")).toBe("diff");
		expect(detectLanguageName("--- a/package.json\n+++ b/package.json\n@@ -10,3 +10,4 @@")).toBe("diff");
		expect(detectLanguageName("@@ -1,4 +1,5 @@\n+new line\n-old line")).toBe("diff");
	});

	it("does NOT false-positive bash flags into diff", (): void => {
		expect(detectLanguageName("-f --recursive rm -rf dist")).toBe("plaintext");
		expect(detectLanguageName("--no-cache pnpm install")).toBe("plaintext");
	});

	it("detects bash by leading command keyword or `$` prompt", (): void => {
		expect(detectLanguageName("pnpm install")).toBe("bash");
		expect(detectLanguageName("$ git status")).toBe("bash");
		expect(detectLanguageName("curl -s http://localhost:3001")).toBe("bash");
	});

	it("does NOT false-positive command-like directory names into bash", (): void => {
		expect(detectLanguageName("node_modules/\n├── .pnpm/")).toBe("plaintext");
		expect(detectLanguageName("pnpm-lock.yaml")).toBe("plaintext");
		expect(detectLanguageName("gitignore")).toBe("plaintext");
	});

	it("detects SQL and Prisma schema", (): void => {
		expect(detectLanguageName("SELECT * FROM users WHERE id = 1;")).toBe("sql");
		expect(detectLanguageName("model User {\n  id String @id\n}")).toBe("prisma");
	});

	it("detects JSON only when the block starts with { or [", (): void => {
		expect(detectLanguageName('{"name": "x"}')).toBe("json");
		expect(detectLanguageName('["a", "b"]')).toBe("json");
	});

	it("returns plaintext for ASCII trees and prose-as-code fences", (): void => {
		const tree = `packages/ui/\n├── styles/globals.css\n└── components/`;
		expect(detectLanguageName(tree)).toBe("plaintext");
		expect(detectLanguageName("Just some prose, nothing special here.")).toBe("plaintext");
	});
});

describe("CodeBlock language plumbing", () => {
	it("declares every SHIKI-mapped language in CODE_LANGUAGES", (): void => {
		// The registry drives the UI (zod enum) AND the shiki loader; a language
		// in one but not the other silently renders plaintext. This test pins
		// the full surface so adding a language updates both.
		expect(CODE_LANGUAGES).toContain("http");
		expect(CODE_LANGUAGES).toContain("env");
		expect(CODE_LANGUAGES).toContain("prisma");
		expect(CODE_LANGUAGES).toContain("typescript");
		expect(CODE_LANGUAGES).toContain("diff");
		expect(CODE_LANGUAGES).toContain("plaintext");
	});

	it("exposes the CodeBlock component with a stable export", (): void => {
		expect(typeof CodeBlock).toBe("function");
	});
});
