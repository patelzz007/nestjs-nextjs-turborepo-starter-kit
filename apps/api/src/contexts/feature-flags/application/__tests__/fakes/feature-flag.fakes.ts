import {
	epochMs,
	type EpochMs,
	type ExposureStats,
	type FeatureFlagKey,
	type FlagOverride,
	type FlagSubjectOption,
	type KillSwitchState,
	type Revision,
} from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { Clock } from "../../../../../platform/application/clock.port";
import { CatalogIndex } from "../../../domain/catalog/catalog-index";
import { EMPTY_FLAG_CATALOG, type FlagCatalog } from "../../../domain/catalog/flag-catalog";
import type { ExposureBatchRecord, ExposureRecorder } from "../../ports/exposure-recorder.port";
import type {
	FlagAdminStore,
	FlagEntryKind,
	NewRevision,
	OverrideChange,
	RevisionDecision,
	RevisionDecisionOutcome,
	RevisionHeads,
	RevisionWriteOutcome,
	Written,
} from "../../ports/flag-admin.store";
import type { FlagCatalogSource } from "../../ports/flag-catalog.port";
import type { ServerExposure, ServerExposures } from "../../ports/server-exposures.port";

export const NOW = 1_800_000_000_000;
export const STAFF_ID = "019b76da-a800-7000-8000-000000000101";
export const OTHER_STAFF_ID = "019b76da-a800-7000-8000-000000000102";

export class FixedClock implements Clock {
	public constructor(public at: number = NOW) {}

	public now(): EpochMs {
		return epochMs(this.at);
	}
}

export function staff(userId: string = STAFF_ID): ActorContext {
	return {
		kind: "user",
		userId,
		sessionId: "session",
		tenantId: null,
		isSuperAdmin: false,
		accessScope: "tenant",
		impersonatorUserId: null,
		request: { requestId: "request", ip: null, userAgent: null, deviceLabel: null, endpoint: null },
	};
}

/** A catalogue the test sets; `changed` versions are recorded. */
export class FakeCatalogSource implements FlagCatalogSource {
	public catalog: FlagCatalog = EMPTY_FLAG_CATALOG;
	public readonly announced: number[] = [];

	public current(): Promise<CatalogIndex> {
		return Promise.resolve(new CatalogIndex(this.catalog));
	}

	public changed(version: number): Promise<void> {
		this.announced.push(version);
		return Promise.resolve();
	}
}

export class RecordingExposures implements ServerExposures, ExposureRecorder {
	public readonly noted: ServerExposure[] = [];
	public readonly batches: ExposureBatchRecord[] = [];

	public note(exposure: ServerExposure): void {
		this.noted.push(exposure);
	}

	public record(batch: ExposureBatchRecord): Promise<void> {
		this.batches.push(batch);
		return Promise.resolve();
	}
}

/** A revision as the in-memory store keeps it: with the flag or config it belongs to. */
type StoredRevision = Revision & { readonly kind: FlagEntryKind; readonly key: string };

const EMPTY_STATS: ExposureStats = { last24h: [], last7d: [], lastExposureAt: null };

/** An in-memory `FlagAdminStore` with the real store's revision rules (one live, one pending, `basedOn`). */
export class InMemoryFlagAdminStore implements FlagAdminStore {
	public readonly rows: StoredRevision[] = [];
	public readonly killed = new Map<FeatureFlagKey, KillSwitchState>();
	public readonly overrideRows: FlagOverride[] = [];
	public groups = new Set<string>();
	public subjects = new Set<string>();
	public totals = new Map<string, { readonly count: number; readonly lastAt: number | null }>();
	private version = 0;

	public heads(_actor: ActorContext, kind: FlagEntryKind): Promise<ReadonlyMap<string, RevisionHeads>> {
		const heads = new Map<string, RevisionHeads>();
		for (const row of this.rows.filter((candidate) => candidate.kind === kind)) {
			const current = heads.get(row.key) ?? { live: null, pending: null };
			if (row.status === "LIVE") heads.set(row.key, { ...current, live: row });
			if (row.status === "PENDING") heads.set(row.key, { ...current, pending: row });
		}
		return Promise.resolve(heads);
	}

	public revisions(_actor: ActorContext, kind: FlagEntryKind, key: string): Promise<readonly Revision[]> {
		return Promise.resolve(this.rows.filter((row) => row.kind === kind && row.key === key).sort((left, right) => right.number - left.number));
	}

	public killSwitches(): Promise<ReadonlyMap<FeatureFlagKey, KillSwitchState>> {
		return Promise.resolve(this.killed);
	}

	public overrides(_actor: ActorContext, key: FeatureFlagKey | null): Promise<readonly FlagOverride[]> {
		return Promise.resolve(this.overrideRows.filter((row) => key === null || row.key === key));
	}

	public groupKeys(): Promise<ReadonlySet<string>> {
		return Promise.resolve(this.groups);
	}

	public exposureTotals(): Promise<ReadonlyMap<string, { readonly count: number; readonly lastAt: number | null }>> {
		return Promise.resolve(this.totals);
	}

	public exposureStats(): Promise<ExposureStats> {
		return Promise.resolve(EMPTY_STATS);
	}

	public writeRevision(actor: ActorContext, revision: NewRevision): Promise<RevisionWriteOutcome> {
		const same = this.rows.filter((row) => row.kind === revision.kind && row.key === revision.key);
		const pending = same.find((row) => row.status === "PENDING");
		if (pending !== undefined) return Promise.resolve({ kind: "PENDING_EXISTS", pending: pending.number });
		const live = same.find((row) => row.status === "LIVE")?.number ?? null;
		if (live !== revision.basedOn) return Promise.resolve({ kind: "CONFLICT", live });
		const goesLive = revision.pendingUntil === null;
		if (goesLive) this.supersede(revision.kind, revision.key);
		const row: StoredRevision = {
			kind: revision.kind,
			key: revision.key,
			id: `00000000-0000-7000-8000-${String(this.rows.length).padStart(12, "0")}`,
			number: same.length + 1,
			status: goesLive ? "LIVE" : "PENDING",
			content: revision.content,
			reason: revision.reason,
			source: revision.source,
			promotedFrom: revision.promotedFrom,
			authorUserId: actor.kind === "user" ? actor.userId : null,
			authorName: "Staff",
			createdAt: epochMs(revision.at),
			decidedAt: goesLive ? epochMs(revision.at) : null,
			decidedByName: null,
			decisionReason: null,
			expiresAt: revision.pendingUntil === null ? null : epochMs(revision.pendingUntil),
		};
		this.rows.push(row);
		return Promise.resolve({ kind: "WRITTEN", written: { value: row, version: goesLive ? this.bump() : null } });
	}

	public decideRevision(actor: ActorContext, decision: RevisionDecision): Promise<RevisionDecisionOutcome> {
		const index = this.rows.findIndex((row) => row.kind === decision.kind && row.key === decision.key && row.number === decision.number);
		const row = this.rows[index];
		if (row === undefined) return Promise.resolve({ kind: "NOT_FOUND" });
		if (row.status !== "PENDING") return Promise.resolve({ kind: "NOT_PENDING" });
		if (actor.kind === "user" && row.authorUserId === actor.userId) return Promise.resolve({ kind: "SELF" });
		if (decision.approve) this.supersede(decision.kind, decision.key);
		const decided: StoredRevision = { ...row, status: decision.approve ? "LIVE" : "REJECTED", decisionReason: decision.reason };
		this.rows.splice(index, 1, decided);
		return Promise.resolve({ kind: "DECIDED", written: { value: decided, version: decision.approve ? this.bump() : null } });
	}

	public setKillSwitch(_actor: ActorContext, key: FeatureFlagKey, on: boolean, reason: string): Promise<Written<KillSwitchState>> {
		const state: KillSwitchState = { on, reason, changedAt: epochMs(NOW), changedByName: "Staff" };
		this.killed.set(key, state);
		return Promise.resolve({ value: state, version: this.bump() });
	}

	public setOverride(_actor: ActorContext, key: FeatureFlagKey, change: OverrideChange): Promise<Written<FlagOverride> | null> {
		if (!this.subjects.has(change.subjectId)) return Promise.resolve(null);
		const override: FlagOverride = {
			id: `00000000-0000-7000-8000-${String(this.overrideRows.length).padStart(12, "1")}`,
			key,
			unit: change.unit,
			subjectId: change.subjectId,
			subjectName: "Someone",
			tenantName: null,
			on: change.on,
			reason: change.reason,
			updatedAt: epochMs(change.at),
			updatedByName: "Staff",
		};
		this.overrideRows.push(override);
		return Promise.resolve({ value: override, version: this.bump() });
	}

	public removeOverride(_actor: ActorContext, key: FeatureFlagKey, overrideId: string): Promise<Written<true> | null> {
		const index = this.overrideRows.findIndex((row) => row.id === overrideId && row.key === key);
		if (index < 0) return Promise.resolve(null);
		this.overrideRows.splice(index, 1);
		return Promise.resolve({ value: true, version: this.bump() });
	}

	public searchSubjects(): Promise<readonly FlagSubjectOption[]> {
		return Promise.resolve([...this.subjects].map((subjectId) => ({ id: subjectId, name: "Someone", detail: null })));
	}

	private supersede(kind: FlagEntryKind, key: string): void {
		this.rows.forEach((row, index) => {
			const superseded: StoredRevision = { ...row, status: "SUPERSEDED" };
			if (row.kind === kind && row.key === key && row.status === "LIVE") this.rows.splice(index, 1, superseded);
		});
	}

	private bump(): number {
		this.version += 1;
		return this.version;
	}
}
