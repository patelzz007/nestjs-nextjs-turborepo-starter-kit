import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { renderBaseWorkspaceEslintConfig } from "./render-eslint-config.js";

const VALID_IMPORT = '{ config as baseConfig } from "@workspace/eslint-config/base"';

export async function isCliEslintConfigValid(rootDir: string): Promise<boolean> {
	const cliPackageJson = path.join(rootDir, "packages/cli/package.json");
	const cliEslintPath = path.join(rootDir, "packages/cli/eslint.config.js");
	if (!existsSync(cliPackageJson) || !existsSync(cliEslintPath)) {
		return true;
	}
	const source = await readFile(cliEslintPath, "utf8");
	return source.includes(VALID_IMPORT) && !source.includes("@workspace/eslint-config/base.js");
}

export async function ensureCliEslintConfig(rootDir: string): Promise<"ok" | "repaired" | "skipped"> {
	const cliPackageJson = path.join(rootDir, "packages/cli/package.json");
	if (!existsSync(cliPackageJson)) {
		return "skipped";
	}
	const cliEslintPath = path.join(rootDir, "packages/cli/eslint.config.js");
	const expected = renderBaseWorkspaceEslintConfig();
	if (!existsSync(cliEslintPath)) {
		await writeFile(cliEslintPath, expected, "utf8");
		return "repaired";
	}
	const current = await readFile(cliEslintPath, "utf8");
	if (!current.includes(VALID_IMPORT) || current.includes("@workspace/eslint-config/base.js")) {
		await writeFile(cliEslintPath, expected, "utf8");
		return "repaired";
	}
	return "ok";
}
