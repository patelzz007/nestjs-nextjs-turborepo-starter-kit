import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

import { z } from "zod";

import { composeConfigs } from "./compose.js";
import { WORKSPACE_PLUGIN } from "./js-plugins.js";

/**
 * Test support for "lint canaries": lint code snippets as if they lived at given
 * paths of a workspace, under that workspace's REAL composed oxlint config, and
 * report which rules fired. A config change that silently drops a boundary fails
 * the canary (rules/13-ci-cd-and-quality-gates.md, "lint canary").
 *
 * The snippets never touch the workspace: the config is written as JSON into a
 * fresh temp directory with each snippet at its relative path (override globs
 * are rooted at the config's directory, so the paths match exactly as they
 * would in the workspace), and the real `oxlint` binary lints them there.
 * Type-aware rules are off — a canary checks syntax-level rules and needs no
 * TypeScript program.
 */

/** The oxlint CLI (its `exports` do not expose `bin/`, so it is located through its package.json). */
const OXLINT_BIN = path.join(path.dirname(createRequire(import.meta.url).resolve("oxlint/package.json")), "bin", "oxlint");

const LintReportSchema = z.object({
	diagnostics: z.array(z.object({ code: z.string(), filename: z.string(), message: z.string() }).loose()),
});

/** `workspace(restricted-imports)` → `workspace/restricted-imports`; `eslint(no-console)` → `no-console`. */
const DIAGNOSTIC_CODE = /^(?<plugin>[\w-]+)\((?<rule>[\w-]+)\)$/u;

/** @param {string} code */
function ruleId(code) {
	const match = DIAGNOSTIC_CODE.exec(code);
	if (match?.groups === undefined) {
		return code;
	}
	const { plugin, rule } = match.groups;
	return plugin === "eslint" ? rule : `${plugin}/${rule}`;
}

/**
 * Lints each snippet as if it were the workspace file at its key.
 *
 * @param {import("oxlint").OxlintConfig} config the workspace's composed config (its `oxlint.config.ts` default export)
 * @param {Readonly<Record<string, string>>} files relative path → source code
 * @returns {Record<string, { ruleId: string, message: string }[]>} relative path → what was reported for it (in report order)
 */
export function lintAsIf(config, files) {
	// The real path: oxlint matches `excludeFiles` against canonical paths, and macOS's
	// temp directory sits behind a symlink (/var → /private/var).
	const directory = realpathSync(mkdtempSync(path.join(tmpdir(), "oxlint-canary-")));
	try {
		// eslint-plugin-turbo looks for the enclosing package; give the snippets one.
		writeFileSync(path.join(directory, "package.json"), JSON.stringify({ name: "oxlint-canary", private: true }));
		const configPath = path.join(directory, ".oxlintrc.json");
		writeFileSync(configPath, JSON.stringify({ ...config, options: { ...config.options, typeAware: false } }));
		for (const [relativePath, code] of Object.entries(files)) {
			const filePath = path.join(directory, relativePath);
			mkdirSync(path.dirname(filePath), { recursive: true });
			writeFileSync(filePath, code);
		}
		const output = runOxlint(directory, configPath, Object.keys(files));
		const report = LintReportSchema.parse(JSON.parse(output));
		/** @type {Record<string, { ruleId: string, message: string }[]>} */
		const result = Object.fromEntries(Object.keys(files).map((relativePath) => [relativePath, []]));
		for (const diagnostic of report.diagnostics) {
			const relativePath = path.relative(directory, path.resolve(directory, diagnostic.filename));
			(result[relativePath] ??= []).push({ ruleId: ruleId(diagnostic.code), message: diagnostic.message });
		}
		return result;
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}

/**
 * Lints one snippet; see `lintAsIf`.
 *
 * @param {import("oxlint").OxlintConfig} config
 * @param {string} code
 * @param {string} relativePath
 * @returns {string[]}
 */
export function ruleIdsFor(config, code, relativePath) {
	return (lintAsIf(config, { [relativePath]: code })[relativePath] ?? []).map((report) => report.ruleId);
}

/**
 * A config that runs ONLY what `extra` sets (every category off), so a rule or a
 * boundary block is tested in isolation. The workspace plugin is always loaded.
 *
 * @param {import("oxlint").OxlintConfig} extra
 * @returns {import("oxlint").OxlintConfig}
 */
export function isolatedConfig(extra) {
	return composeConfigs(
		{
			plugins: ["eslint", "typescript"],
			jsPlugins: [WORKSPACE_PLUGIN],
			categories: { correctness: "off", suspicious: "off", pedantic: "off", perf: "off", style: "off", restriction: "off", nursery: "off" },
		},
		extra,
	);
}

/**
 * The messages one rule reports for one snippet; see `lintAsIf`.
 *
 * @param {import("oxlint").OxlintConfig} config
 * @param {string} code
 * @param {string} relativePath
 * @param {string} rule the rule id, e.g. `workspace/restricted-imports`
 * @returns {string[]}
 */
export function ruleMessagesFor(config, code, relativePath, rule) {
	return (lintAsIf(config, { [relativePath]: code })[relativePath] ?? []).filter((report) => report.ruleId === rule).map((report) => report.message);
}

/** oxlint exits 1 when it reports errors; the JSON report on stdout is the result either way. */
function runOxlint(directory, configPath, relativePaths) {
	try {
		return execFileSync(process.execPath, [OXLINT_BIN, "-c", configPath, "-f", "json", ...relativePaths], { cwd: directory, encoding: "utf8" });
	} catch (error) {
		const FailedRunSchema = z.object({ status: z.literal(1), stdout: z.string().min(1) }).loose();
		const failed = FailedRunSchema.safeParse(error);
		if (failed.success) {
			return failed.data.stdout;
		}
		throw error;
	}
}
