import {
	epochMs,
	FEATURE_FLAG_REGISTRY,
	FeatureFlagKeySchema,
	FLAG_SUBJECT_SEARCH_LIMIT,
	type DeploymentEnvironment,
	type FeatureFlagDetail,
	type FeatureFlagEnvironment,
	type FeatureFlagKey,
	type FeatureFlagSummary,
	type FeatureFlagSummaryList,
	type FlagOverride,
	type FlagRule,
	type FlagSubjectOptionList,
	type FlagSubjectSearchQuery,
	type KillSwitchState,
	type Revision,
	type RevisionDecisionInput,
	type RevisionList,
	type SaveFlagRevisionInput,
	type SetFlagOverrideInput,
	type SetKillSwitchInput,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import { FlagOverrideNotFoundError, FlagSubjectNotFoundError } from "../../domain/errors/feature-flag.errors";
import { assertValidFlagRules } from "../../domain/policies/flag-rules.policy";
import { readyToRemove } from "../../domain/policies/ready-to-remove.policy";
import type { FlagAdminStore, RevisionHeads } from "../ports/flag-admin.store";
import type { FlagCatalogSource } from "../ports/flag-catalog.port";
import type { RevisionWorkflow } from "./revision-workflow";

const MS_PER_DAY = 86_400_000;
const NO_HEADS: RevisionHeads = { live: null, pending: null };
const NO_KILL_SWITCH: KillSwitchState = { on: false, reason: null, changedAt: null, changedByName: null };

function rulesOf(revision: Revision | null): readonly FlagRule[] {
	return revision?.content.kind === "FLAG" ? revision.content.rules : [];
}

/** The console's Feature flags pages (ADR 087): every declared flag with its state, its history and its controls. */
export class FlagAdminService {
	public constructor(
		private readonly store: FlagAdminStore,
		private readonly workflow: RevisionWorkflow,
		private readonly catalog: FlagCatalogSource,
		private readonly clock: Clock,
		private readonly environment: DeploymentEnvironment,
	) {}

	public environmentInfo(): FeatureFlagEnvironment {
		return { environment: this.environment, approvalsRequired: this.workflow.approvalsRequired };
	}

	public async list(actor: ActorContext): Promise<FeatureFlagSummaryList> {
		const now = this.clock.now();
		const [heads, killSwitches, overrides, exposures] = await Promise.all([
			this.store.heads(actor, "FLAG"),
			this.store.killSwitches(actor),
			this.store.overrides(actor, null),
			this.store.exposureTotals(actor, "FLAG", now - MS_PER_DAY),
		]);
		return {
			flags: FeatureFlagKeySchema.options.map((key) =>
				this.summary(
					key,
					heads.get(key) ?? NO_HEADS,
					killSwitches.get(key) ?? NO_KILL_SWITCH,
					overrides.filter((override) => override.key === key),
					exposures.get(key) ?? null,
					now,
				),
			),
		};
	}

	public async detail(actor: ActorContext, key: FeatureFlagKey): Promise<FeatureFlagDetail> {
		const now = this.clock.now();
		const [heads, killSwitches, overrides, exposures] = await Promise.all([
			this.store.heads(actor, "FLAG"),
			this.store.killSwitches(actor),
			this.store.overrides(actor, key),
			this.store.exposureStats(actor, "FLAG", key, now),
		]);
		const flagHeads = heads.get(key) ?? NO_HEADS;
		const totals = { count: exposures.last24h.reduce((sum, row) => sum + row.exposures, 0), lastAt: exposures.lastExposureAt };
		return {
			...this.summary(key, flagHeads, killSwitches.get(key) ?? NO_KILL_SWITCH, overrides, totals, now),
			live: flagHeads.live,
			pending: flagHeads.pending,
			overrides: [...overrides],
			exposures,
		};
	}

	public async revisions(actor: ActorContext, key: FeatureFlagKey): Promise<RevisionList> {
		return { revisions: [...(await this.store.revisions(actor, "FLAG", key))] };
	}

	public async saveRevision(actor: ActorContext, key: FeatureFlagKey, input: SaveFlagRevisionInput): Promise<Revision> {
		assertValidFlagRules(key, input.rules, await this.store.groupKeys(actor));
		return this.workflow.save(actor, {
			kind: "FLAG",
			key,
			content: { kind: "FLAG", rules: input.rules },
			reason: input.reason,
			basedOn: input.basedOn,
			source: "CONSOLE",
			promotedFrom: null,
		});
	}

	public decideRevision(actor: ActorContext, key: FeatureFlagKey, number: number, input: RevisionDecisionInput): Promise<Revision> {
		return this.workflow.decide(actor, "FLAG", key, number, input.decision === "APPROVE", input.reason);
	}

	/** Never waits for approval: an emergency off has to work at once. */
	public async setKillSwitch(actor: ActorContext, key: FeatureFlagKey, input: SetKillSwitchInput): Promise<KillSwitchState> {
		const written = await this.store.setKillSwitch(actor, key, input.on, input.reason);
		await this.announce(written.version);
		return written.value;
	}

	public async setOverride(actor: ActorContext, key: FeatureFlagKey, input: SetFlagOverrideInput): Promise<FlagOverride> {
		const written = await this.store.setOverride(actor, key, { unit: input.unit, subjectId: input.subjectId, on: input.on, reason: input.reason, at: this.clock.now() });
		if (written === null) {
			throw new FlagSubjectNotFoundError(input.unit, input.subjectId);
		}
		await this.announce(written.version);
		return written.value;
	}

	/** The reason travels in the request body, which the request audit keeps. */
	public async removeOverride(actor: ActorContext, key: FeatureFlagKey, overrideId: string): Promise<void> {
		const written = await this.store.removeOverride(actor, key, overrideId, this.clock.now());
		if (written === null) {
			throw new FlagOverrideNotFoundError(overrideId);
		}
		await this.announce(written.version);
	}

	public async searchSubjects(actor: ActorContext, query: FlagSubjectSearchQuery): Promise<FlagSubjectOptionList> {
		return { subjects: [...(await this.store.searchSubjects(actor, query.unit, query.search ?? "", FLAG_SUBJECT_SEARCH_LIMIT))] };
	}

	private summary(
		key: FeatureFlagKey,
		heads: RevisionHeads,
		killSwitch: KillSwitchState,
		overrides: readonly FlagOverride[],
		exposures: { readonly count: number; readonly lastAt: number | null } | null,
		now: number,
	): FeatureFlagSummary {
		const definition = FEATURE_FLAG_REGISTRY[key];
		const rules = rulesOf(heads.live);
		const changes = [heads.live?.decidedAt ?? heads.live?.createdAt ?? null, killSwitch.changedAt].flatMap((at) => (at === null ? [] : [at]));
		const lastChangedAt = changes.length === 0 ? null : Math.max(...changes);
		return {
			key,
			title: definition.title,
			description: definition.description,
			rolloutUnit: definition.rolloutUnit,
			apps: [...definition.apps],
			defaultOn: definition.defaultOn,
			killSwitch,
			liveRevision: heads.live?.number ?? null,
			ruleCount: rules.length,
			pendingRevision: heads.pending?.number ?? null,
			overrideCount: overrides.length,
			updatedAt: lastChangedAt === null ? null : epochMs(lastChangedAt),
			readyToRemove: readyToRemove(
				{ killed: killSwitch.on, lastChangedAt, rules, overrideCount: overrides.length, lastExposureAt: exposures?.lastAt ?? null, trackedSince: lastChangedAt },
				now,
			),
			exposures24h: exposures?.count ?? 0,
		};
	}

	private async announce(version: number | null): Promise<void> {
		if (version !== null) {
			await this.catalog.changed(version);
		}
	}
}
