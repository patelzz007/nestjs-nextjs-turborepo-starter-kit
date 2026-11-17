import { randomBytes } from "node:crypto";

import {
	EXPERIMENT_METRIC_REGISTRY,
	ExperimentMetricKeySchema,
	type CreateExperimentInput,
	type DynamicConfigKey,
	type Experiment,
	type ExperimentDetail,
	type ExperimentList,
	type ExperimentMetricOptionList,
	type ExperimentVariant,
	type StartExperimentInput,
	type StopExperimentInput,
	type UpdateExperimentInput,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import {
	ExperimentConfigBusyError,
	ExperimentKeyTakenError,
	ExperimentNotFoundError,
	ExperimentPlanInvalidError,
	ExperimentStateError,
} from "../../domain/errors/feature-flag.errors";
import type { ExperimentStore, ExperimentWriteOutcome } from "../ports/experiment.store";
import type { FlagAdminStore } from "../ports/flag-admin.store";
import type { FlagCatalogSource } from "../ports/flag-catalog.port";

/** Bytes of randomness in an experiment's salt (hex-encoded, so twice as many characters). */
const SALT_BYTES = 8;

/**
 * The console's Experiments pages (ADR 087): plan an experiment on a dynamic config, start and stop it, read its
 * results (worked out by the analytics consumer). Its variants must be values of the config's live revision.
 */
export class ExperimentService {
	public constructor(
		private readonly store: ExperimentStore,
		private readonly flags: FlagAdminStore,
		private readonly catalog: FlagCatalogSource,
		private readonly clock: Clock,
	) {}

	public metrics(): ExperimentMetricOptionList {
		return {
			metrics: ExperimentMetricKeySchema.options.map((key) => ({
				key,
				title: EXPERIMENT_METRIC_REGISTRY[key].title,
				description: EXPERIMENT_METRIC_REGISTRY[key].description,
				higherIsBetter: EXPERIMENT_METRIC_REGISTRY[key].higherIsBetter,
			})),
		};
	}

	public async list(actor: ActorContext): Promise<ExperimentList> {
		return { experiments: [...(await this.store.list(actor))] };
	}

	public async detail(actor: ActorContext, experimentId: string): Promise<ExperimentDetail> {
		const experiment = await this.store.find(actor, experimentId);
		if (experiment === null) {
			throw new ExperimentNotFoundError(experimentId);
		}
		return { ...experiment, results: await this.store.results(actor, experimentId) };
	}

	public async create(actor: ActorContext, input: CreateExperimentInput): Promise<ExperimentDetail> {
		await this.assertVariantsExist(actor, input.key, input.configKey, input.variants);
		const written = await this.store.create(actor, input, randomBytes(SALT_BYTES).toString("hex"));
		if (written === null) {
			throw new ExperimentKeyTakenError(input.key);
		}
		return this.detail(actor, written.value.id);
	}

	public async update(actor: ActorContext, experimentId: string, input: UpdateExperimentInput): Promise<ExperimentDetail> {
		const current = await this.existing(actor, experimentId);
		await this.assertVariantsExist(actor, experimentId, current.configKey, input.variants);
		await this.settle(experimentId, await this.store.update(actor, experimentId, input));
		return this.detail(actor, experimentId);
	}

	/** Its variants are checked again: the config's values may have changed since it was planned. */
	public async start(actor: ActorContext, experimentId: string, input: StartExperimentInput): Promise<ExperimentDetail> {
		const current = await this.existing(actor, experimentId);
		await this.assertVariantsExist(actor, experimentId, current.configKey, current.variants);
		await this.settle(experimentId, await this.store.start(actor, experimentId, input.reason, this.clock.now()), current.configKey);
		return this.detail(actor, experimentId);
	}

	public async stop(actor: ActorContext, experimentId: string, input: StopExperimentInput): Promise<ExperimentDetail> {
		await this.settle(experimentId, await this.store.stop(actor, experimentId, input.reason, input.conclusion, this.clock.now()));
		return this.detail(actor, experimentId);
	}

	private async existing(actor: ActorContext, experimentId: string): Promise<Experiment> {
		const experiment = await this.store.find(actor, experimentId);
		if (experiment === null) {
			throw new ExperimentNotFoundError(experimentId);
		}
		return experiment;
	}

	private async assertVariantsExist(actor: ActorContext, reference: string, configKey: DynamicConfigKey, variants: readonly ExperimentVariant[]): Promise<void> {
		const live = (await this.flags.heads(actor, "CONFIG")).get(configKey)?.live ?? null;
		const names = new Set(live?.content.kind === "CONFIG" ? live.content.values.map((value) => value.name) : []);
		const missing = variants.filter((variant) => !names.has(variant.valueName)).map((variant) => variant.valueName);
		if (missing.length > 0) {
			throw new ExperimentPlanInvalidError(reference, `The config's live values don't include: ${missing.join(", ")}. Add them to the config first.`);
		}
	}

	private async settle(experimentId: string, outcome: ExperimentWriteOutcome, configKey?: DynamicConfigKey): Promise<void> {
		switch (outcome.kind) {
			case "NOT_FOUND":
				throw new ExperimentNotFoundError(experimentId);
			case "WRONG_STATE":
				throw new ExperimentStateError(experimentId, outcome.status);
			case "CONFIG_BUSY":
				throw new ExperimentConfigBusyError(configKey ?? experimentId);
			case "WRITTEN":
				if (outcome.written.version !== null) {
					await this.catalog.changed(outcome.written.version);
				}
		}
	}
}
