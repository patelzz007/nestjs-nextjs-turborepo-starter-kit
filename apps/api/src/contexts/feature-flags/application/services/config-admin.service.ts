import {
	DYNAMIC_CONFIG_REGISTRY,
	DynamicConfigKeySchema,
	epochMs,
	JsonObjectSchema,
	type DynamicConfigDetail,
	type DynamicConfigKey,
	type DynamicConfigSummary,
	type DynamicConfigSummaryList,
	type Revision,
	type RevisionDecisionInput,
	type RevisionList,
	type SaveConfigRevisionInput,
} from "@workspace/shared";
import { z } from "zod";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import { assertValidConfigContent } from "../../domain/policies/flag-rules.policy";
import type { ExperimentStore } from "../ports/experiment.store";
import type { FlagAdminStore, RevisionHeads } from "../ports/flag-admin.store";
import type { RevisionWorkflow } from "./revision-workflow";

const MS_PER_DAY = 86_400_000;
const NO_HEADS: RevisionHeads = { live: null, pending: null };

/** The experiment running on `key`, if any (keys compared as strings: the registry may declare a single config). */
function runningExperimentOn(experiments: readonly { readonly id: string; readonly configKey: string; readonly status: string }[], key: string): string | null {
	return experiments.find((experiment) => experiment.configKey === key && experiment.status === "RUNNING")?.id ?? null;
}

/** The declared value shape as JSON Schema, for the console's editor. */
function valueJsonSchema(key: DynamicConfigKey): z.output<typeof JsonObjectSchema> {
	return JsonObjectSchema.parse(z.toJSONSchema(DYNAMIC_CONFIG_REGISTRY[key].schema));
}

/** The console's Dynamic configs pages (ADR 087): every declared config, its values, rules and history. */
export class ConfigAdminService {
	public constructor(
		private readonly store: FlagAdminStore,
		private readonly experiments: ExperimentStore,
		private readonly workflow: RevisionWorkflow,
		private readonly clock: Clock,
	) {}

	public async list(actor: ActorContext): Promise<DynamicConfigSummaryList> {
		const [heads, exposures, experiments] = await Promise.all([
			this.store.heads(actor, "CONFIG"),
			this.store.exposureTotals(actor, "CONFIG", this.clock.now() - MS_PER_DAY),
			this.experiments.list(actor),
		]);
		return {
			configs: DynamicConfigKeySchema.options.map((key) =>
				this.summary(key, heads.get(key) ?? NO_HEADS, exposures.get(key)?.count ?? 0, runningExperimentOn(experiments, key)),
			),
		};
	}

	public async detail(actor: ActorContext, key: DynamicConfigKey): Promise<DynamicConfigDetail> {
		const [heads, exposures, experiments] = await Promise.all([
			this.store.heads(actor, "CONFIG"),
			this.store.exposureStats(actor, "CONFIG", key, this.clock.now()),
			this.experiments.list(actor),
		]);
		const configHeads = heads.get(key) ?? NO_HEADS;
		const running = runningExperimentOn(experiments, key);
		const exposures24h = exposures.last24h.reduce((sum, row) => sum + row.exposures, 0);
		return { ...this.summary(key, configHeads, exposures24h, running), live: configHeads.live, pending: configHeads.pending, exposures };
	}

	public async revisions(actor: ActorContext, key: DynamicConfigKey): Promise<RevisionList> {
		return { revisions: [...(await this.store.revisions(actor, "CONFIG", key))] };
	}

	public async saveRevision(actor: ActorContext, key: DynamicConfigKey, input: SaveConfigRevisionInput): Promise<Revision> {
		assertValidConfigContent(key, input.content, await this.store.groupKeys(actor));
		return this.workflow.save(actor, { kind: "CONFIG", key, content: input.content, reason: input.reason, basedOn: input.basedOn, source: "CONSOLE", promotedFrom: null });
	}

	public decideRevision(actor: ActorContext, key: DynamicConfigKey, number: number, input: RevisionDecisionInput): Promise<Revision> {
		return this.workflow.decide(actor, "CONFIG", key, number, input.decision === "APPROVE", input.reason);
	}

	private summary(key: DynamicConfigKey, heads: RevisionHeads, exposures24h: number, runningExperimentId: string | null): DynamicConfigSummary {
		const definition = DYNAMIC_CONFIG_REGISTRY[key];
		const content = heads.live?.content.kind === "CONFIG" ? heads.live.content : null;
		const updatedAt = heads.live?.decidedAt ?? heads.live?.createdAt ?? null;
		return {
			key,
			title: definition.title,
			description: definition.description,
			rolloutUnit: definition.rolloutUnit,
			apps: [...definition.apps],
			defaultValue: definition.defaultValue,
			valueJsonSchema: valueJsonSchema(key),
			liveRevision: heads.live?.number ?? null,
			valueCount: content?.values.length ?? 0,
			ruleCount: content?.rules.length ?? 0,
			pendingRevision: heads.pending?.number ?? null,
			runningExperimentId,
			updatedAt: updatedAt === null ? null : epochMs(updatedAt),
			exposures24h,
		};
	}
}
