import type {
	DeploymentEnvironment,
	ExposureStats,
	FeatureFlagKey,
	FlagOverride,
	FlagOverrideUnit,
	FlagSubjectOption,
	KillSwitchState,
	Revision,
	RevisionContent,
	RevisionSource,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";

export type FlagEntryKind = "FLAG" | "CONFIG";

/** One flag's or config's revision state, for the lists. */
export interface RevisionHeads {
	readonly live: Revision | null;
	readonly pending: Revision | null;
}

/** A new revision to write. `pendingUntil` set: it waits for a second person until then (production). */
export interface NewRevision {
	readonly kind: FlagEntryKind;
	readonly key: string;
	readonly content: RevisionContent;
	readonly reason: string;
	readonly source: RevisionSource;
	readonly promotedFrom: DeploymentEnvironment | null;
	/** The live revision the author started from; a different live one refuses the write. */
	readonly basedOn: number | null;
	readonly pendingUntil: number | null;
	readonly at: number;
}

/** A write's outcome: what was written and the catalogue version it raised (null: nothing a bundle reads changed). */
export interface Written<T> {
	readonly value: T;
	readonly version: number | null;
}

export type RevisionWriteOutcome =
	| { readonly kind: "WRITTEN"; readonly written: Written<Revision> }
	| { readonly kind: "CONFLICT"; readonly live: number | null }
	/** A pending revision exists: a new one would replace it unseen. */
	| { readonly kind: "PENDING_EXISTS"; readonly pending: number };

export type RevisionDecisionOutcome =
	| { readonly kind: "DECIDED"; readonly written: Written<Revision> }
	| { readonly kind: "NOT_FOUND" }
	| { readonly kind: "NOT_PENDING" }
	| { readonly kind: "SELF" }
	/** The live revision moved since this one was written (another change went live first). */
	| { readonly kind: "CONFLICT"; readonly live: number | null };

export interface OverrideChange {
	readonly unit: FlagOverrideUnit;
	readonly subjectId: string;
	readonly on: boolean;
	readonly reason: string;
	readonly at: number;
}

export interface RevisionDecision {
	readonly kind: FlagEntryKind;
	readonly key: string;
	readonly number: number;
	readonly approve: boolean;
	readonly reason: string;
	readonly at: number;
}

/** The flags' and configs' stored state, under `feature_flags.read` / `feature_flags.write`. */
export interface FlagAdminStore {
	heads(actor: ActorContext, kind: FlagEntryKind): Promise<ReadonlyMap<string, RevisionHeads>>;
	revisions(actor: ActorContext, kind: FlagEntryKind, key: string): Promise<readonly Revision[]>;
	killSwitches(actor: ActorContext): Promise<ReadonlyMap<FeatureFlagKey, KillSwitchState>>;
	overrides(actor: ActorContext, key: FeatureFlagKey | null): Promise<readonly FlagOverride[]>;
	/** Live flag group keys (a rule may only name these). */
	groupKeys(actor: ActorContext): Promise<ReadonlySet<string>>;
	/** Exposure counts per flag or config over the last day, and each one's latest exposure. */
	exposureTotals(actor: ActorContext, kind: FlagEntryKind, since: number): Promise<ReadonlyMap<string, { readonly count: number; readonly lastAt: number | null }>>;
	exposureStats(actor: ActorContext, kind: FlagEntryKind, key: string, now: number): Promise<ExposureStats>;

	writeRevision(actor: ActorContext, revision: NewRevision): Promise<RevisionWriteOutcome>;
	decideRevision(actor: ActorContext, decision: RevisionDecision): Promise<RevisionDecisionOutcome>;
	setKillSwitch(actor: ActorContext, key: FeatureFlagKey, on: boolean, reason: string): Promise<Written<KillSwitchState>>;
	/** Replaces the subject's live override. Null: the subject doesn't exist. */
	setOverride(actor: ActorContext, key: FeatureFlagKey, change: OverrideChange): Promise<Written<FlagOverride> | null>;
	/** Null: no live override with that id for the flag. */
	removeOverride(actor: ActorContext, key: FeatureFlagKey, overrideId: string, at: number): Promise<Written<true> | null>;
	searchSubjects(actor: ActorContext, unit: FlagOverrideUnit, search: string, limit: number): Promise<readonly FlagSubjectOption[]>;
}

export const FLAG_ADMIN_STORE = Symbol("FLAG_ADMIN_STORE");
