import { spawn } from "node:child_process";
import path from "node:path";

import * as p from "@clack/prompts";
import pc from "picocolors";

import { resolveWorkspaceBin } from "../core/resolve-workspace-bin";

export interface ValidationResult {
	readonly success: boolean;
	readonly output: string;
}

export interface PostGenerateValidationOptions {
	readonly useSpinner?: boolean;
	readonly resourceSlug?: string;
	readonly writtenPaths?: readonly string[];
}

const COMMAND_TIMEOUT_MS = 300_000;

async function runCommand(executable: string, args: string[], cwd: string): Promise<ValidationResult> {
	return new Promise((resolve, reject) => {
		const child = spawn(executable, args, { cwd, stdio: ["ignore", "pipe", "pipe"], shell: false });
		let output = "";
		let settled = false;
		const timeout = setTimeout(() => {
			if (!settled) {
				settled = true;
				child.kill("SIGTERM");
				resolve({ success: false, output: `${output}\nCommand timed out after ${String(COMMAND_TIMEOUT_MS)}ms` });
			}
		}, COMMAND_TIMEOUT_MS);
		child.stdout.on("data", (chunk: Buffer) => {
			output += chunk.toString();
		});
		child.stderr.on("data", (chunk: Buffer) => {
			output += chunk.toString();
		});
		child.on("error", (error) => {
			if (!settled) {
				settled = true;
				clearTimeout(timeout);
				reject(error);
			}
		});
		child.on("close", (code) => {
			if (!settled) {
				settled = true;
				clearTimeout(timeout);
				resolve({ success: code === 0, output });
			}
		});
	});
}

async function runScopedLint(repoRoot: string, resourceSlug: string | undefined): Promise<ValidationResult> {
	const outputs: string[] = [];
	const turboBin = resolveWorkspaceBin(repoRoot, "turbo");

	const packageLint = await runCommand(turboBin, ["lint", "--only", "--filter=@workspace/shared", "--filter=@workspace/client"], repoRoot);
	outputs.push(packageLint.output);
	if (!packageLint.success) {
		return { success: false, output: outputs.join("\n") };
	}

	if (resourceSlug === undefined) {
		return { success: true, output: outputs.join("\n") };
	}

	const apiEslintBin = resolveWorkspaceBin(repoRoot, "eslint", "apps/api");
	const apiModuleLint = await runCommand(apiEslintBin, [`src/modules/${resourceSlug}`], path.join(repoRoot, "apps/api"));
	outputs.push(apiModuleLint.output);
	if (!apiModuleLint.success) {
		return { success: false, output: outputs.join("\n") };
	}

	const adminEslintBin = resolveWorkspaceBin(repoRoot, "eslint", "apps/admin");
	const adminPanelLint = await runCommand(adminEslintBin, [`app/(panel)/${resourceSlug}`], path.join(repoRoot, "apps/admin"));
	outputs.push(adminPanelLint.output);

	return { success: adminPanelLint.success, output: outputs.join("\n") };
}

async function runScopedTypecheck(repoRoot: string): Promise<ValidationResult> {
	const turboBin = resolveWorkspaceBin(repoRoot, "turbo");
	return runCommand(
		turboBin,
		["typecheck", "--only", "--filter=@workspace/shared", "--filter=@workspace/client", "--filter=@workspace/api", "--filter=@workspace/admin"],
		repoRoot,
	);
}

async function runScopedFormat(repoRoot: string, writtenPaths: readonly string[]): Promise<ValidationResult> {
	const formattablePaths = writtenPaths.filter((filePath) => /\.(?:tsx?|json|mjs|cjs)$/.test(filePath));
	if (formattablePaths.length === 0) {
		return { success: true, output: "" };
	}
	const prettierBin = resolveWorkspaceBin(repoRoot, "prettier");
	return runCommand(prettierBin, ["--write", ...formattablePaths], repoRoot);
}

export async function runPostGenerateValidation(repoRoot: string, options: PostGenerateValidationOptions = {}): Promise<ValidationResult[]> {
	const writtenPaths = options.writtenPaths ?? [];
	const steps: { label: string; run: () => Promise<ValidationResult> }[] = [
		{ label: "format", run: () => runScopedFormat(repoRoot, writtenPaths) },
		{ label: "lint", run: () => runScopedLint(repoRoot, options.resourceSlug) },
		{ label: "typecheck", run: () => runScopedTypecheck(repoRoot) },
	];
	const results: ValidationResult[] = [];
	const spinner = options.useSpinner === true ? p.spinner() : undefined;

	for (const step of steps) {
		if (spinner !== undefined) {
			spinner.start(`Running ${step.label}…`);
		} else {
			process.stdout.write(`${pc.cyan(`Running ${step.label}...`)}\n`);
		}

		let result: ValidationResult;
		try {
			result = await step.run();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			result = { success: false, output: message };
		}
		results.push(result);

		if (!result.success) {
			if (spinner !== undefined) {
				spinner.stop(`${step.label} failed`);
				p.log.error("Generated files were kept for debugging.");
				if (result.output.length > 0) {
					process.stdout.write(`${result.output}\n`);
				}
			} else {
				process.stdout.write(pc.red(`${step.label} failed. Generated files were kept for debugging.\n`));
				if (result.output.length > 0) {
					process.stdout.write(`${result.output}\n`);
				}
			}
			break;
		}

		if (spinner !== undefined) {
			spinner.stop(`${step.label} passed`);
		}
	}

	return results;
}
