/**
 * The one-off conversion of an older kanban board to the split model (docs/technical/kanban.md →
 * "Converting an older board"). Run it after migration 1, before migration 2:
 *
 *   pnpm db:kanban-convert -- --dry-run   every stage in one transaction, rolled back: the report only
 *   pnpm db:kanban-convert                each stage in its own transaction, recorded when it commits
 *   pnpm db:kanban-convert -- --verify    what still stands between the board and migration 2
 *
 * A stage that has committed (a `KanbanConversionStage` row) is skipped, so an interrupted run
 * resumes where it stopped. Every stage takes the board lock the API takes, so no edit interleaves.
 * Delete this script with migration 2 (it reads the retired column, table and enum value).
 */
import { randomUUID } from "node:crypto";

import { PrismaClient, type Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { KanbanItemType } from "@workspace/shared";
import { z } from "zod";

import { ACTOR_SETTING } from "../../prisma/rls/row-audit";
import { KANBAN_CONVERSION_OPERATION } from "../../src/contexts/kanban/infrastructure/kanban-conversion.operation";
import { KANBAN_BOARD_LOCK_KEY } from "../../src/contexts/kanban/infrastructure/persistence/prisma-kanban-board.repository";
import { EXIT_FAILED, EXIT_OK, PROCESS_OUTPUT, type CliOutput } from "../lib/cli";
import {
	KANBAN_CONVERSION_STAGES,
	planChecklists,
	planColumns,
	planKeys,
	planPlanningTriage,
	verifyConversion,
	type BoardSnapshot,
	type KanbanConversionStageName,
} from "../lib/kanban-conversion";

/** Who the conversion's soft deletes and row audit name. */
const CONVERSION_ACTOR = "system:kanban-convert";

/** A stage on a large board rewrites every item once; give its transaction room beyond Prisma's 5-second default. */
const STAGE_TIMEOUT_MS = 120_000;

const ConvertArgumentsSchema = z.object({ mode: z.enum(["run", "dry-run", "verify"]) }).strict();
export type ConvertArguments = z.output<typeof ConvertArgumentsSchema>;

export function parseConvertArguments(argv: readonly string[]): ConvertArguments {
	const flags = argv.filter((arg) => arg !== "--");
	if (flags.length > 1) {
		throw new Error("Usage: kanban-convert [--dry-run | --verify]");
	}
	const [flag] = flags;
	if (flag === undefined) {
		return { mode: "run" };
	}
	if (flag === "--dry-run" || flag === "--verify") {
		return ConvertArgumentsSchema.parse({ mode: flag.slice("--".length) });
	}
	throw new Error(`Unknown option ${flag}. Usage: kanban-convert [--dry-run | --verify]`);
}

/** Thrown inside a dry run's transaction so it rolls back after every stage has planned and written. */
class DryRunRollback extends Error {
	public constructor(public readonly reports: ReadonlyMap<KanbanConversionStageName, Prisma.InputJsonObject>) {
		super("dry run: rolled back");
	}
}

/** Everything a plan reads, under the lock, as the transaction sees it. */
async function readSnapshot(tx: Prisma.TransactionClient): Promise<BoardSnapshot> {
	const [legacyColumns, planningColumns, executionColumns, items, counters, legacySubtasks] = await Promise.all([
		tx.kanbanColumn.findMany({ where: { isDeleted: false }, select: { id: true, board: true, title: true, kind: true, position: true, wipLimit: true } }),
		tx.kanbanPlanningColumn.findMany({ where: { isDeleted: false }, select: { id: true, title: true, stage: true, position: true } }),
		tx.kanbanExecutionColumn.findMany({ where: { isDeleted: false }, select: { id: true, title: true, state: true, position: true } }),
		tx.kanbanTask.findMany({
			select: {
				id: true,
				type: true,
				key: true,
				createdAt: true,
				parentId: true,
				ownerId: true,
				priority: true,
				team: true,
				columnId: true,
				planningColumnId: true,
				executionColumnId: true,
				position: true,
				isDeleted: true,
			},
		}),
		tx.kanbanLevelCounter.findMany({ select: { level: true, lastNumber: true } }),
		tx.kanbanChecklistItem.findMany({
			where: { list: "SUBTASKS", isDeleted: false },
			select: { id: true, taskId: true, title: true, depth: true, isDone: true, assigneeId: true, position: true },
		}),
	]);
	return {
		legacyColumns,
		planningColumns,
		executionColumns,
		items: items.map((item) => ({ ...item, createdAt: Number(item.createdAt) })),
		counters: new Map(counters.map((counter): [KanbanItemType, number] => [counter.level, counter.lastNumber])),
		legacySubtasks,
	};
}

async function lockBoard(tx: Prisma.TransactionClient): Promise<void> {
	await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${KANBAN_BOARD_LOCK_KEY}, 0))`;
}

/** Writes one stage's plan on the board as `tx` sees it; answers its report. */
async function applyStage(tx: Prisma.TransactionClient, stage: KanbanConversionStageName, now: bigint): Promise<Prisma.InputJsonObject> {
	const snapshot = await readSnapshot(tx);
	switch (stage) {
		case "KEYS": {
			const plan = planKeys(snapshot);
			for (const assignment of plan.assignments) {
				await tx.kanbanTask.update({ where: { id: assignment.itemId }, data: { key: assignment.key } });
			}
			for (const [level, lastNumber] of plan.counters) {
				await tx.kanbanLevelCounter.upsert({ where: { level }, create: { level, lastNumber }, update: { lastNumber } });
			}
			return {
				keyed: plan.assignments.length,
				mapping: plan.assignments.map((assignment) => `${assignment.itemId} → ${assignment.key}`),
				counters: Object.fromEntries(plan.counters),
			};
		}
		case "COLUMNS": {
			const plan = planColumns(snapshot, randomUUID);
			if (plan.problems.length > 0) {
				throw new Error(`The column split refuses to run:\n  ${plan.problems.join("\n  ")}`);
			}
			await tx.kanbanPlanningColumn.createMany({ data: [...plan.planningColumns] });
			await tx.kanbanExecutionColumn.createMany({ data: [...plan.executionColumns] });
			for (const placement of plan.placements) {
				await tx.kanbanTask.update({
					where: { id: placement.itemId },
					data:
						placement.board === "PLANNING"
							? { planningColumnId: placement.columnId, position: placement.position }
							: { executionColumnId: placement.columnId, position: placement.position },
				});
			}
			return {
				planningColumns: plan.planningColumns.map((column) => `${column.title} (${column.stage})`),
				executionColumns: plan.executionColumns.map((column) => `${column.title} (${column.state})`),
				placed: plan.placements.length,
			};
		}
		case "PLANNING_TRIAGE": {
			const moves = planPlanningTriage(snapshot);
			for (const move of moves) {
				await tx.kanbanTask.update({ where: { id: move.itemId }, data: { planningColumnId: move.columnId, position: move.position } });
				const actor = snapshot.items.find((item) => item.id === move.itemId)?.ownerId;
				if (actor !== undefined) {
					await tx.kanbanTaskActivity.create({
						data: { taskId: move.itemId, actorId: actor, kind: "MOVED", fromValue: "In Progress", toValue: move.stage === "READY" ? "Ready" : "Refining" },
					});
				}
			}
			return { triaged: moves.map((move) => `${move.key ?? move.itemId} → ${move.stage}`) };
		}
		case "CHECKLISTS": {
			const plan = planChecklists(snapshot, randomUUID);
			for (const subtask of plan.subtasks) {
				await tx.kanbanTask.create({
					data: {
						id: subtask.id,
						key: subtask.key,
						type: "SUBTASK",
						parentId: subtask.taskId,
						ownerId: subtask.ownerId,
						assigneeId: subtask.assigneeId,
						title: subtask.title,
						description: "",
						priority: subtask.priority,
						team: subtask.team,
						progress: subtask.isDone ? 100 : 0,
						executionColumnId: subtask.columnId,
						position: subtask.position,
					},
				});
				await tx.kanbanTaskWatcher.create({ data: { taskId: subtask.id, userId: subtask.ownerId } });
				await tx.kanbanTaskActivity.create({ data: { taskId: subtask.id, actorId: subtask.ownerId, kind: "CREATED", toValue: "Converted from the task's checklist" } });
				if (subtask.steps.length > 0) {
					await tx.kanbanChecklistItem.createMany({ data: subtask.steps.map((step) => ({ ...step, taskId: subtask.id, list: "STEPS" })) });
				}
			}
			if (plan.retiredRowIds.length > 0) {
				await tx.kanbanChecklistItem.updateMany({
					where: { id: { in: [...plan.retiredRowIds] }, isDeleted: false },
					data: { isDeleted: true, deletedAt: now, deletedBy: CONVERSION_ACTOR },
				});
			}
			await tx.kanbanLevelCounter.upsert({
				where: { level: "SUBTASK" },
				create: { level: "SUBTASK", lastNumber: plan.subtaskCounter },
				update: { lastNumber: plan.subtaskCounter },
			});
			return {
				subtasks: plan.subtasks.map((subtask) => `${subtask.key} ${subtask.title} (${String(subtask.steps.length)} step(s)) under ${subtask.taskId}`),
				retiredRows: plan.retiredRowIds.length,
			};
		}
	}
}

/** Runs `work` as the conversion operation: `app_runtime` with its registry scope, as the API runs. */
function underConversion<T>(prisma: PrismaClient, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
	return prisma.$transaction(
		async (tx: Prisma.TransactionClient): Promise<T> => {
			await tx.$executeRaw`SELECT
				set_config('role', 'app_runtime', true),
				set_config('app.rls_bypass', 'true', true),
				set_config('app.system_operation', ${KANBAN_CONVERSION_OPERATION}, true),
				set_config(${ACTOR_SETTING}, ${CONVERSION_ACTOR}, true)`;
			await lockBoard(tx);
			return work(tx);
		},
		{ timeout: STAGE_TIMEOUT_MS },
	);
}

/** Migration 1 created the conversion's marker table; without it nothing here can run. */
async function migrationOneApplied(prisma: PrismaClient): Promise<boolean> {
	const rows = await prisma.$queryRaw<{ readonly present: boolean }[]>`SELECT to_regclass('public."KanbanConversionStage"') IS NOT NULL AS present`;
	return rows.some((row) => row.present);
}

function printReport(output: CliOutput, stage: KanbanConversionStageName, report: Prisma.InputJsonObject): void {
	output.out(`── ${stage}`);
	output.out(JSON.stringify(report, null, "\t"));
}

export async function runConversion(prisma: PrismaClient, args: ConvertArguments, output: CliOutput): Promise<number> {
	if (!(await migrationOneApplied(prisma))) {
		output.err("Migration 1 (kanban_split_columns_keys_subtasks) has not been applied: run `pnpm tools db:deploy` first. Nothing was changed.");
		return EXIT_FAILED;
	}
	if (args.mode === "verify") {
		const issues = await underConversion(prisma, async (tx) => verifyConversion(await readSnapshot(tx)));
		const done = await prisma.kanbanConversionStage.findMany({ select: { stage: true } });
		const missing = KANBAN_CONVERSION_STAGES.filter((stage) => !done.some((row) => row.stage === stage));
		for (const issue of [...issues, ...missing.map((stage) => `Stage ${stage} has not run.`)]) {
			output.err(`✗ ${issue}`);
		}
		if (issues.length > 0 || missing.length > 0) {
			return EXIT_FAILED;
		}
		output.out("✓ Every item is keyed and on its board, no checklist row is left, every counter is ahead of its keys: migration 2 may run.");
		return EXIT_OK;
	}
	const now = BigInt(Date.now());
	if (args.mode === "dry-run") {
		try {
			await underConversion(prisma, async (tx): Promise<void> => {
				const reports = new Map<KanbanConversionStageName, Prisma.InputJsonObject>();
				for (const stage of KANBAN_CONVERSION_STAGES) {
					reports.set(stage, await applyStage(tx, stage, now));
				}
				throw new DryRunRollback(reports);
			});
		} catch (error) {
			if (!(error instanceof DryRunRollback)) {
				throw error;
			}
			for (const [stage, report] of error.reports) {
				printReport(output, stage, report);
			}
			output.out("Dry run: nothing was written.");
		}
		return EXIT_OK;
	}
	for (const stage of KANBAN_CONVERSION_STAGES) {
		if ((await prisma.kanbanConversionStage.count({ where: { stage } })) > 0) {
			output.out(`── ${stage}: done before, skipped`);
			continue;
		}
		const report = await underConversion(prisma, async (tx): Promise<Prisma.InputJsonObject> => {
			const stageReport = await applyStage(tx, stage, now);
			await tx.kanbanConversionStage.create({ data: { stage, completedAt: BigInt(Date.now()), report: stageReport } });
			return stageReport;
		});
		printReport(output, stage, report);
	}
	output.out("Converted. Review the report, then run `pnpm db:kanban-convert -- --verify` before migration 2.");
	return EXIT_OK;
}

async function main(): Promise<number> {
	const args = parseConvertArguments(process.argv.slice(2));
	const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, application_name: "kanban-convert" }) });
	try {
		return await runConversion(prisma, args, PROCESS_OUTPUT);
	} finally {
		await prisma.$disconnect();
	}
}

if (process.env.VITEST !== "true") {
	void main().then((code: number): void => {
		process.exitCode = code;
	});
}
