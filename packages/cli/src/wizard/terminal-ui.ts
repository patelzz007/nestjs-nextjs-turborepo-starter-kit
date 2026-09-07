import pc from "picocolors";

import { printAppBanner } from "../ui/brand";

export interface WizardStep {
	readonly current: number;
	readonly total: number;
}

export function printWizardIntro(): void {
	printAppBanner();
	process.stdout.write(`${pc.bold(pc.magenta("Resource wizard"))}  ${pc.dim("—")}  ${pc.dim("table, API, contracts & admin UI in one flow")}\n`);
	process.stdout.write(`${pc.cyan("ℹ")}  ${pc.dim("Primary keys (id) and timestamps are added automatically.")}\n`);
}

export function printSection(title: string, step?: WizardStep): void {
	const prefix = step !== undefined ? `${pc.magenta(`◆ Step ${String(step.current)}/${String(step.total)}`)}  ` : `${pc.magenta("◆")}  `;
	process.stdout.write(`\n${prefix}${pc.bold(pc.white(title))}\n`);
	process.stdout.write(`${pc.dim("╰" + "─".repeat(Math.max(title.length + 4, 28)))}\n`);
}

export function printNote(message: string): void {
	process.stdout.write(`  ${pc.cyan("→")} ${pc.dim(message)}\n`);
}

export function printSuccess(message: string): void {
	process.stdout.write(`  ${pc.green("✓")} ${message}\n`);
}

export function printWarning(message: string): void {
	process.stdout.write(`  ${pc.yellow("!")} ${message}\n`);
}

export function printFieldSummary(fields: readonly { name: string; type: string; relation?: string }[]): void {
	if (fields.length === 0) {
		return;
	}
	process.stdout.write(`\n  ${pc.bold("Fields")}\n`);
	for (const field of fields) {
		const relationSuffix = field.relation !== undefined ? pc.dim(` → ${field.relation}`) : "";
		process.stdout.write(`    ${pc.cyan("•")} ${field.name} ${pc.dim(`(${field.type})`)}${relationSuffix}\n`);
	}
	process.stdout.write("\n");
}
