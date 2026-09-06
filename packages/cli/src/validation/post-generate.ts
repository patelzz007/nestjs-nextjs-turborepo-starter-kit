import { spawn } from "node:child_process";

import * as p from "@clack/prompts";
import pc from "picocolors";

export interface ValidationResult {
	readonly success: boolean;
	readonly output: string;
}

export interface PostGenerateValidationOptions {
	readonly useSpinner?: boolean;
	readonly resourceSlug?: string;
}

async function runCommand(command: string, args: string[], cwd: string): Promise<ValidationResult> {
	return new Promise((resolve) => {
		const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"], shell: false });
		let output = "";
		child.stdout.on("data", (chunk: Buffer) => {
			output += chunk.toString();
		});
		child.stderr.on("data", (chunk: Buffer) => {
			output += chunk.toString();
		});
		child.on("close", (code) => {
			resolve({ success: code === 0, output });
		});
	});
}

async function runScopedLint(repoRoot: string, resourceSlug: string | undefined): Promise<ValidationResult> {
	const outputs: string[] = [];

	const packageLint = await runCommand(
		"pnpm",
		["exec", "turbo", "lint", "--only", "--filter=@workspace/shared", "--filter=@workspace/client", "--filter=@workspace/cli"],
		repoRoot,
	);
	outputs.push(packageLint.output);
	if (!packageLint.success) {
		return { success: false, output: outputs.join("\n") };
	}

	if (resourceSlug === undefined) {
		return { success: true, output: outputs.join("\n") };
	}

	const apiModuleLint = await runCommand("pnpm", ["--filter", "@workspace/api", "exec", "eslint", `src/modules/${resourceSlug}`], repoRoot);
	outputs.push(apiModuleLint.output);
	if (!apiModuleLint.success) {
		return { success: false, output: outputs.join("\n") };
	}

	const adminPanelLint = await runCommand("pnpm", ["--filter", "@workspace/admin", "exec", "eslint", `app/(panel)/${resourceSlug}`], repoRoot);
	outputs.push(adminPanelLint.output);

	return { success: adminPanelLint.success, output: outputs.join("\n") };
}

async function runScopedTypecheck(repoRoot: string): Promise<ValidationResult> {
	return runCommand("pnpm", ["exec", "turbo", "typecheck", "--only", "--filter=@workspace/shared", "--filter=@workspace/client", "--filter=@workspace/cli"], repoRoot);
}

export async function runPostGenerateValidation(repoRoot: string, options: PostGenerateValidationOptions = {}): Promise<ValidationResult[]> {
	const steps: { label: string; run: () => Promise<ValidationResult> }[] = [
		{ label: "format", run: () => runCommand("pnpm", ["run", "format"], repoRoot) },
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

		const result = await step.run();
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
