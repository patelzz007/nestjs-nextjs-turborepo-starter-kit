import pc from "picocolors";

import type { PlanAction } from "../core/planner.js";
import type { ResourceIR } from "../ir/types.js";

const ACTION_ICONS: Record<PlanAction["action"], string> = {
	create: pc.green("＋"),
	modify: pc.yellow("↻"),
	skip: pc.blue("○"),
	conflict: pc.red("✕"),
};

const ACTION_LABELS: Record<PlanAction["action"], string> = {
	create: pc.green("create"),
	modify: pc.yellow("modify"),
	skip: pc.blue("skip"),
	conflict: pc.red("conflict"),
};

function countByAction(actions: readonly PlanAction[]): Record<PlanAction["action"], number> {
	const counts: Record<PlanAction["action"], number> = {
		create: 0,
		modify: 0,
		skip: 0,
		conflict: 0,
	};
	for (const action of actions) {
		counts[action.action] += 1;
	}
	return counts;
}

export function printResourceSummary(ir: ResourceIR): void {
	const fieldCount = ir.fields.length;
	const relationCount = ir.relations.length;
	const adminLabel = ir.admin?.navigation?.label ?? ir.resource.plural;

	process.stdout.write(`${pc.bold(pc.white("Resource"))}\n`);
	process.stdout.write(`  ${pc.dim("Name")}       ${pc.cyan(ir.resource.name)} ${pc.dim(`(${ir.resource.slug})`)}\n`);
	process.stdout.write(`  ${pc.dim("Model")}      ${ir.resource.modelName}\n`);
	process.stdout.write(`  ${pc.dim("Admin")}      ${adminLabel}\n`);
	process.stdout.write(`  ${pc.dim("RLS")}        ${ir.rls}\n`);
	process.stdout.write(`  ${pc.dim("Fields")}     ${String(fieldCount)} scalar${relationCount > 0 ? pc.dim(`, ${String(relationCount)} relation(s)`) : ""}\n`);
	process.stdout.write("\n");
}

export function printGenerationPlan(actions: readonly PlanAction[]): void {
	const counts = countByAction(actions);
	const summaryParts: string[] = [];
	if (counts.create > 0) {
		summaryParts.push(pc.green(`${String(counts.create)} new`));
	}
	if (counts.modify > 0) {
		summaryParts.push(pc.yellow(`${String(counts.modify)} update`));
	}
	if (counts.skip > 0) {
		summaryParts.push(pc.blue(`${String(counts.skip)} skip`));
	}
	if (counts.conflict > 0) {
		summaryParts.push(pc.red(`${String(counts.conflict)} conflict`));
	}

	process.stdout.write(`${pc.bold(pc.white("Generation plan"))}  ${summaryParts.join(pc.dim(" · "))}\n`);
	process.stdout.write(`${pc.dim("─".repeat(52))}\n`);

	const grouped: Record<PlanAction["action"], PlanAction[]> = {
		create: [],
		modify: [],
		skip: [],
		conflict: [],
	};
	for (const action of actions) {
		grouped[action.action].push(action);
	}

	const order: PlanAction["action"][] = ["create", "modify", "skip", "conflict"];
	for (const actionType of order) {
		const group = grouped[actionType];
		if (group.length === 0) {
			continue;
		}
		process.stdout.write(`\n  ${ACTION_ICONS[actionType]} ${ACTION_LABELS[actionType]} ${pc.dim(`(${String(group.length)})`)}\n`);
		for (const action of group) {
			process.stdout.write(`    ${pc.dim("│")} ${action.path}\n`);
			if (action.reason.length > 0) {
				process.stdout.write(`    ${pc.dim("│")} ${pc.dim(action.reason)}\n`);
			}
		}
	}
	process.stdout.write("\n");
}

export function printDoctorResults(checks: readonly { label: string; ok: boolean; detail?: string }[]): void {
	process.stdout.write(`${pc.bold(pc.white("Environment check"))}\n`);
	process.stdout.write(`${pc.dim("─".repeat(40))}\n`);
	for (const check of checks) {
		const icon = check.ok ? pc.green("✓") : pc.red("✗");
		const detail = check.detail !== undefined ? pc.dim(`  ${check.detail}`) : "";
		process.stdout.write(`  ${icon}  ${check.label}${detail}\n`);
	}
	process.stdout.write("\n");
}

export function printRoutesTable(rows: readonly { slug: string; contractKey: string; label: string; fieldCount: number }[]): void {
	if (rows.length === 0) {
		process.stdout.write(`${pc.yellow("!")} No resource definitions found.\n`);
		process.stdout.write(`${pc.dim("Create one with:")} ${pc.cyan("pnpm app new resource")}\n\n`);
		return;
	}

	process.stdout.write(`${pc.bold(pc.white("Registered resources"))}  ${pc.dim(`(${String(rows.length)})`)}\n`);
	process.stdout.write(`${pc.dim("─".repeat(56))}\n`);
	for (const row of rows) {
		process.stdout.write(
			`  ${pc.cyan(row.slug.padEnd(20))} ${pc.dim("→")} /${row.slug}  ${pc.dim(row.contractKey)}  ${pc.dim(`${String(row.fieldCount)} fields`)}  ${pc.white(row.label)}\n`,
		);
	}
	process.stdout.write(`\n${pc.dim("Generate:")} ${pc.cyan("pnpm app generate resource <slug>")}\n\n`);
}
