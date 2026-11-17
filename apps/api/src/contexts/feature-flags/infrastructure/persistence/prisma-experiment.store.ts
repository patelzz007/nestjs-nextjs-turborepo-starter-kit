import type { Prisma } from "@prisma/client";
import {
	DYNAMIC_CONFIG_REGISTRY,
	DynamicConfigKeySchema,
	epochMs,
	ExperimentMetricKeySchema,
	ExperimentVariantSchema,
	ConfigValueNameSchema,
	type CreateExperimentInput,
	type Experiment,
	type ExperimentResults,
	type UpdateExperimentInput,
} from "@workspace/shared";
import { z } from "zod";

import { actingUserId, type ActorContext } from "../../../../platform/application/actor-context";
import { isUniqueViolationOf } from "../../../../platform/infrastructure/persistence/unique-violation";
import type { ExperimentStore, ExperimentWriteOutcome } from "../../application/ports/experiment.store";
import { FEATURE_FLAGS_READ_OPERATION, FEATURE_FLAGS_WRITE_OPERATION } from "../../application/ports/feature-flags.operations";
import type { Written } from "../../application/ports/flag-admin.store";
import { bumpCatalogVersion, namesOf, type FlagTransactions } from "./flag-transactions";

const VariantListSchema = z.array(ExperimentVariantSchema);
const EXPERIMENT_KEY_INDEX = "Experiment_key_key";
const RUNNING_CONFIG_INDEX = "Experiment_configKey_key";
const NONE = 0;

type ExperimentRow = Prisma.ExperimentGetPayload<object>;

function toExperiment(row: ExperimentRow, names: ReadonlyMap<string, string>): Experiment {
	const configKey = DynamicConfigKeySchema.parse(row.configKey);
	return {
		id: row.id,
		key: row.key,
		configKey,
		rolloutUnit: DYNAMIC_CONFIG_REGISTRY[configKey].rolloutUnit,
		status: row.status,
		name: row.name,
		hypothesis: row.hypothesis,
		trafficPercentage: row.trafficPercentage,
		variants: VariantListSchema.parse(row.variants),
		controlValueName: ConfigValueNameSchema.parse(row.controlValueName),
		primaryMetric: ExperimentMetricKeySchema.parse(row.primaryMetric),
		guardrailMetrics: row.guardrailMetrics.map((metric) => ExperimentMetricKeySchema.parse(metric)),
		plannedEndAt: row.plannedEndAt === null ? null : epochMs(Number(row.plannedEndAt)),
		startedAt: row.startedAt === null ? null : epochMs(Number(row.startedAt)),
		stoppedAt: row.stoppedAt === null ? null : epochMs(Number(row.stoppedAt)),
		conclusion: row.conclusion,
		createdByName: row.createdBy === null ? null : (names.get(row.createdBy) ?? null),
		updatedAt: epochMs(Number(row.updatedAt)),
	};
}

function planData(input: UpdateExperimentInput): Prisma.ExperimentUpdateInput {
	return {
		name: input.name,
		hypothesis: input.hypothesis,
		trafficPercentage: input.trafficPercentage,
		variants: input.variants,
		controlValueName: input.controlValueName,
		primaryMetric: input.primaryMetric,
		guardrailMetrics: input.guardrailMetrics,
		plannedEndAt: input.plannedEndAt === null ? null : BigInt(input.plannedEndAt),
		reason: input.reason,
	};
}

/** `ExperimentStore` over Prisma (ADR 087). Starting or stopping one changes what bundles answer, so it raises the version. */
export class PrismaExperimentStore implements ExperimentStore {
	public constructor(private readonly transactions: FlagTransactions) {}

	public list(actor: ActorContext): Promise<readonly Experiment[]> {
		return this.read(actor, "read the experiments", async (tx) => {
			const rows = await tx.experiment.findMany({ where: { isDeleted: false }, orderBy: { createdAt: "desc" } });
			const names = await namesOf(
				tx,
				rows.map((row) => row.createdBy),
			);
			return rows.map((row) => toExperiment(row, names));
		});
	}

	public find(actor: ActorContext, experimentId: string): Promise<Experiment | null> {
		return this.read(actor, "read an experiment", async (tx) => this.findIn(tx, experimentId));
	}

	public results(actor: ActorContext, experimentId: string): Promise<ExperimentResults> {
		return this.read(actor, "read an experiment's results", async (tx) => {
			const rows = await tx.experimentResult.findMany({ where: { experimentId, isDeleted: false }, orderBy: [{ metric: "asc" }, { valueName: "asc" }] });
			const computedAt = rows.reduce<number | null>((latest, row) => Math.max(latest ?? NONE, Number(row.computedAt)), null);
			return {
				experimentId,
				computedAt: computedAt === null ? null : epochMs(computedAt),
				results: rows.map((row) => ({
					metric: ExperimentMetricKeySchema.parse(row.metric),
					valueName: ConfigValueNameSchema.parse(row.valueName),
					subjects: row.subjects,
					mean: row.mean,
					delta: row.delta,
					ciLow: row.ciLow,
					ciHigh: row.ciHigh,
					significant: row.significant,
				})),
			};
		});
	}

	public async create(actor: ActorContext, input: CreateExperimentInput, salt: string): Promise<Written<Experiment> | null> {
		try {
			return await this.write(actor, `plan the experiment ${input.key}`, async (tx): Promise<Written<Experiment> | null> => {
				if ((await tx.experiment.count({ where: { key: input.key, isDeleted: false } })) > NONE) {
					return null;
				}
				const row = await tx.experiment.create({
					data: {
						key: input.key,
						configKey: input.configKey,
						name: input.name,
						hypothesis: input.hypothesis,
						status: "DRAFT",
						trafficPercentage: input.trafficPercentage,
						variants: input.variants,
						controlValueName: input.controlValueName,
						primaryMetric: input.primaryMetric,
						guardrailMetrics: input.guardrailMetrics,
						salt,
						plannedEndAt: input.plannedEndAt === null ? null : BigInt(input.plannedEndAt),
						reason: input.reason,
					},
				});
				return { value: toExperiment(row, await namesOf(tx, [row.createdBy])), version: null };
			});
		} catch (error) {
			if (error instanceof Error && isUniqueViolationOf(error, EXPERIMENT_KEY_INDEX)) {
				return null;
			}
			throw error;
		}
	}

	public update(actor: ActorContext, experimentId: string, input: UpdateExperimentInput): Promise<ExperimentWriteOutcome> {
		return this.transition(actor, experimentId, "change an experiment's plan", "DRAFT", async (tx) => {
			await tx.experiment.update({ where: { id: experimentId }, data: planData(input) });
			return null;
		});
	}

	public async start(actor: ActorContext, experimentId: string, reason: string, at: number): Promise<ExperimentWriteOutcome> {
		try {
			return await this.transition(actor, experimentId, "start an experiment", "DRAFT", async (tx) => {
				await tx.experiment.update({ where: { id: experimentId }, data: { status: "RUNNING", startedAt: BigInt(at), reason } });
				return bumpCatalogVersion(tx);
			});
		} catch (error) {
			if (error instanceof Error && isUniqueViolationOf(error, RUNNING_CONFIG_INDEX)) {
				return { kind: "CONFIG_BUSY" };
			}
			throw error;
		}
	}

	public stop(actor: ActorContext, experimentId: string, reason: string, conclusion: string, at: number): Promise<ExperimentWriteOutcome> {
		return this.transition(actor, experimentId, "stop an experiment", "RUNNING", async (tx) => {
			await tx.experiment.update({ where: { id: experimentId }, data: { status: "STOPPED", stoppedAt: BigInt(at), conclusion, reason } });
			return bumpCatalogVersion(tx);
		});
	}

	/** Runs `change` when the experiment is in `from`; answers the experiment as it now is. */
	private transition(
		actor: ActorContext,
		experimentId: string,
		what: string,
		from: Experiment["status"],
		change: (tx: Prisma.TransactionClient) => Promise<number | null>,
	): Promise<ExperimentWriteOutcome> {
		return this.write(actor, what, async (tx): Promise<ExperimentWriteOutcome> => {
			const current = await tx.experiment.findFirst({ where: { id: experimentId, isDeleted: false }, select: { status: true } });
			if (current === null) {
				return { kind: "NOT_FOUND" };
			}
			if (current.status !== from) {
				return { kind: "WRONG_STATE", status: current.status };
			}
			const version = await change(tx);
			const experiment = await this.findIn(tx, experimentId);
			return experiment === null ? { kind: "NOT_FOUND" } : { kind: "WRITTEN", written: { value: experiment, version } };
		});
	}

	private async findIn(tx: Prisma.TransactionClient, experimentId: string): Promise<Experiment | null> {
		const row = await tx.experiment.findFirst({ where: { id: experimentId, isDeleted: false } });
		return row === null ? null : toExperiment(row, await namesOf(tx, [row.createdBy]));
	}

	private read<T>(actor: ActorContext, what: string, handler: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
		return this.transactions.withSystemOperation({ operation: FEATURE_FLAGS_READ_OPERATION, reason: `Experiments: ${what}`, actorUserId: actingUserId(actor) }, handler);
	}

	private write<T>(actor: ActorContext, what: string, handler: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
		return this.transactions.withSystemOperation({ operation: FEATURE_FLAGS_WRITE_OPERATION, reason: `Experiments: ${what}`, actorUserId: actingUserId(actor) }, handler);
	}
}
