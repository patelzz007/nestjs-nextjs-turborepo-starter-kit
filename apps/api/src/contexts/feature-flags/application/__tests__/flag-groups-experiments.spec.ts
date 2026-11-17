import {
	epochMs,
	type ConfigRevisionContent,
	type CreateExperimentInput,
	type Experiment,
	type FlagGroup,
	type FlagGroupMemberListQuery,
	type PromotionFile,
} from "@workspace/shared";
import { describe, expect, it } from "vitest";

import type { ActorContext } from "../../../../platform/application/actor-context";
import {
	ExperimentConfigBusyError,
	ExperimentPlanInvalidError,
	ExperimentStateError,
	FlagGroupInUseError,
	FlagGroupInvalidError,
	FlagGroupNotFoundError,
	PromotionInvalidError,
} from "../../domain/errors/feature-flag.errors";
import type { ExperimentStore, ExperimentWriteOutcome } from "../ports/experiment.store";
import type { Written } from "../ports/flag-admin.store";
import type { FlagGroupChange, FlagGroupStore, MemberChangeOutcome, MemberPage, NewFlagGroup } from "../ports/flag-group.store";
import type { FlagMaintenanceStore } from "../ports/flag-maintenance.store";
import { ExperimentService } from "../services/experiment.service";
import { FlagGroupService } from "../services/flag-group.service";
import { FlagMaintenanceService, SCHEDULE_LOOKBACK_MS } from "../services/flag-maintenance.service";
import { PromotionService } from "../services/promotion.service";
import { RevisionWorkflow } from "../services/revision-workflow";
import { FakeCatalogSource, FixedClock, InMemoryFlagAdminStore, NOW, staff } from "./fakes/feature-flag.fakes";

const GROUP_ID = "019b76da-a800-7000-8000-000000000201";
const MEMBER = "019b76da-a800-7000-8000-000000000001";

class InMemoryGroupStore implements FlagGroupStore {
	public readonly groups: FlagGroup[] = [];
	public memberIds: string[] = [];

	public list(): Promise<readonly FlagGroup[]> {
		return Promise.resolve(this.groups);
	}

	public find(_actor: ActorContext, groupId: string): Promise<FlagGroup | null> {
		return Promise.resolve(this.groups.find((group) => group.id === groupId) ?? null);
	}

	public create(_actor: ActorContext, group: NewFlagGroup): Promise<Written<FlagGroup> | null> {
		if (this.groups.some((existing) => existing.key === group.key)) return Promise.resolve(null);
		const created: FlagGroup = {
			id: GROUP_ID,
			key: group.key,
			name: group.name,
			description: group.description,
			definition: group.definition,
			memberCount: 0,
			usedBy: [],
			updatedAt: epochMs(NOW),
			updatedByName: null,
		};
		this.groups.push(created);
		return Promise.resolve({ value: created, version: 1 });
	}

	public update(_actor: ActorContext, groupId: string, change: FlagGroupChange): Promise<Written<FlagGroup> | null> {
		const group = this.groups.find((existing) => existing.id === groupId);
		return Promise.resolve(group === undefined ? null : { value: { ...group, name: change.name }, version: 2 });
	}

	public remove(_actor: ActorContext, groupId: string): Promise<Written<true> | null> {
		return Promise.resolve(this.groups.some((group) => group.id === groupId) ? { value: true, version: 3 } : null);
	}

	public changeMembers(_actor: ActorContext, groupId: string, action: "ADD" | "REMOVE", subjectIds: readonly string[], maxMembers: number): Promise<MemberChangeOutcome> {
		const group = this.groups.find((existing) => existing.id === groupId);
		if (group === undefined) return Promise.resolve({ kind: "NOT_FOUND" });
		if (group.definition.kind !== "LIST") return Promise.resolve({ kind: "NOT_LISTED" });
		const next = action === "ADD" ? [...new Set([...this.memberIds, ...subjectIds])] : this.memberIds.filter((id) => !subjectIds.includes(id));
		if (next.length > maxMembers) return Promise.resolve({ kind: "TOO_MANY", limit: maxMembers });
		const changed = Math.abs(next.length - this.memberIds.length);
		this.memberIds = next;
		return Promise.resolve({ kind: "CHANGED", written: { value: { changed, memberCount: next.length }, version: changed > 0 ? 4 : null } });
	}

	public members(_actor: ActorContext, groupId: string, query: FlagGroupMemberListQuery): Promise<MemberPage | null> {
		if (!this.groups.some((group) => group.id === groupId)) return Promise.resolve(null);
		return Promise.resolve({
			total: this.memberIds.length,
			items: this.memberIds.slice(0, query.limit).map((subjectId) => ({ subjectId, name: null, addedAt: epochMs(NOW), addedByName: null })),
		});
	}
}

describe("FlagGroupService", () => {
	function setup(): { readonly service: FlagGroupService; readonly store: InMemoryGroupStore; readonly catalog: FakeCatalogSource } {
		const store = new InMemoryGroupStore();
		const catalog = new FakeCatalogSource();
		return { service: new FlagGroupService(store, catalog, new FixedClock()), store, catalog };
	}

	it("creates a group, refuses a taken key, and announces each change", async () => {
		const { service, catalog } = setup();
		await service.create(staff(), { key: "beta", name: "Beta", description: "", definition: { kind: "LIST", unit: "USER" }, reason: "Customers who asked" });
		await expect(
			service.create(staff(), { key: "beta", name: "Beta again", description: "", definition: { kind: "LIST", unit: "USER" }, reason: "Customers who asked" }),
		).rejects.toThrow();
		expect(catalog.announced).toStrictEqual([1]);
	});

	it("keeps a group's kind: conditions only for a condition group, members only for a listed one", async () => {
		const { service } = setup();
		const group = await service.create(staff(), { key: "beta", name: "Beta", description: "", definition: { kind: "LIST", unit: "USER" }, reason: "Customers who asked" });
		await expect(
			service.update(staff(), group.id, { name: "Beta", description: "", conditions: [{ attribute: "PLATFORM_STAFF", is: true }], reason: "Change to staff" }),
		).rejects.toBeInstanceOf(FlagGroupInvalidError);
		expect((await service.changeMembers(staff(), group.id, { action: "ADD", subjectIds: [MEMBER], reason: "One more tester" })).memberCount).toBe(1);
		const page = await service.members(staff(), group.id, { limit: 10, page: 1 });
		expect(page).toMatchObject({ total: 1, page: 1, totalPages: 1, hasNext: false, hasPrevious: false });
	});

	it("refuses to remove a group rules still name, and answers 404 for one that doesn't exist", async () => {
		const { service, store } = setup();
		const group = await service.create(staff(), { key: "beta", name: "Beta", description: "", definition: { kind: "LIST", unit: "USER" }, reason: "Customers who asked" });
		store.groups.splice(0, 1, { ...group, usedBy: [{ kind: "FLAG", key: "web-activity" }] });
		await expect(service.remove(staff(), group.id)).rejects.toBeInstanceOf(FlagGroupInUseError);
		await expect(service.find(staff(), MEMBER)).rejects.toBeInstanceOf(FlagGroupNotFoundError);
	});
});

const LIVE_CONFIG: ConfigRevisionContent = {
	kind: "CONFIG",
	values: [
		{ name: "standard", value: { emphasis: "standard" } },
		{ name: "bold", value: { emphasis: "bold" } },
	],
	rules: [],
};

const PLAN: CreateExperimentInput = {
	key: "bold-claim",
	configKey: "reward-claim-cta",
	name: "Bold claim",
	hypothesis: "Bold claims more",
	trafficPercentage: 50,
	variants: [
		{ valueName: "standard", allocation: 50 },
		{ valueName: "bold", allocation: 50 },
	],
	controlValueName: "standard",
	primaryMetric: "reward-claims",
	guardrailMetrics: [],
	plannedEndAt: null,
	reason: "Planned at the design review",
};

class InMemoryExperimentStore implements ExperimentStore {
	public experiment: Experiment | null = null;
	public next: ExperimentWriteOutcome | null = null;
	/** The reasons each write was given (the audit trail keeps them). */
	public readonly reasons: string[] = [];

	public list(): Promise<readonly Experiment[]> {
		return Promise.resolve(this.experiment === null ? [] : [this.experiment]);
	}

	public find(): Promise<Experiment | null> {
		return Promise.resolve(this.experiment);
	}

	public results(_actor: ActorContext, experimentId: string): ReturnType<ExperimentStore["results"]> {
		return Promise.resolve({ experimentId, computedAt: null, results: [] });
	}

	public create(_actor: ActorContext, input: CreateExperimentInput): Promise<Written<Experiment> | null> {
		const { reason, ...plan } = input;
		this.reasons.push(reason);
		this.experiment = {
			...plan,
			id: GROUP_ID,
			rolloutUnit: "USER",
			status: "DRAFT",
			startedAt: null,
			stoppedAt: null,
			conclusion: null,
			createdByName: null,
			updatedAt: epochMs(NOW),
		};
		return Promise.resolve({ value: this.experiment, version: null });
	}

	public update(): Promise<ExperimentWriteOutcome> {
		return this.outcome();
	}

	public start(): Promise<ExperimentWriteOutcome> {
		return this.outcome();
	}

	public stop(): Promise<ExperimentWriteOutcome> {
		return this.outcome();
	}

	private outcome(): Promise<ExperimentWriteOutcome> {
		return Promise.resolve(this.next ?? (this.experiment === null ? { kind: "NOT_FOUND" } : { kind: "WRITTEN", written: { value: this.experiment, version: 5 } }));
	}
}

describe("ExperimentService", () => {
	async function setup(): Promise<{ readonly service: ExperimentService; readonly store: InMemoryExperimentStore; readonly catalog: FakeCatalogSource }> {
		const flags = new InMemoryFlagAdminStore();
		await flags.writeRevision(staff(), {
			kind: "CONFIG",
			key: "reward-claim-cta",
			content: LIVE_CONFIG,
			reason: "The two styles",
			source: "CONSOLE",
			promotedFrom: null,
			basedOn: null,
			pendingUntil: null,
			at: NOW,
		});
		const store = new InMemoryExperimentStore();
		const catalog = new FakeCatalogSource();
		return { service: new ExperimentService(store, flags, catalog, new FixedClock()), store, catalog };
	}

	it("plans an experiment on values the config has, and refuses one it doesn't", async () => {
		const { service } = await setup();
		expect(await service.create(staff(), PLAN)).toMatchObject({ status: "DRAFT", results: { results: [] } });
		await expect(service.create(staff(), { ...PLAN, variants: [{ valueName: "neon", allocation: 100 }], controlValueName: "neon" })).rejects.toBeInstanceOf(
			ExperimentPlanInvalidError,
		);
		expect(service.metrics().metrics.map((metric) => metric.key)).toStrictEqual(["reward-claims", "reward-redemptions", "sign-ins"]);
	});

	it("starts and announces, and maps a busy config or a wrong state to their errors", async () => {
		const { service, store, catalog } = await setup();
		const planned = await service.create(staff(), PLAN);
		await service.start(staff(), planned.id, { reason: "Design signed off" });
		expect(catalog.announced).toStrictEqual([5]);
		store.next = { kind: "CONFIG_BUSY" };
		await expect(service.start(staff(), planned.id, { reason: "Again" })).rejects.toBeInstanceOf(ExperimentConfigBusyError);
		store.next = { kind: "WRONG_STATE", status: "STOPPED" };
		await expect(service.stop(staff(), planned.id, { reason: "Done", conclusion: "Bold wins" })).rejects.toBeInstanceOf(ExperimentStateError);
	});
});

describe("PromotionService", () => {
	async function setup(environment: "development" | "staging" | "production"): Promise<{ readonly service: PromotionService; readonly groups: InMemoryGroupStore }> {
		const flags = new InMemoryFlagAdminStore();
		await flags.writeRevision(staff(), {
			kind: "FLAG",
			key: "web-activity",
			content: {
				kind: "FLAG",
				rules: [{ id: MEMBER, name: "Beta", conditions: [{ attribute: "FLAG_GROUP", operator: "IN_GROUP", groupKey: "staff" }], rollout: { kind: "FIXED", percentage: 100 } }],
			},
			reason: "Staff first",
			source: "CONSOLE",
			promotedFrom: null,
			basedOn: null,
			pendingUntil: null,
			at: NOW,
		});
		flags.groups = new Set(["staff"]);
		const groups = new InMemoryGroupStore();
		await groups.create(staff(), {
			key: "staff",
			name: "Staff",
			description: "",
			definition: { kind: "CONDITIONS", conditions: [{ attribute: "PLATFORM_STAFF", is: true }] },
			reason: "Staff",
		});
		const catalog = new FakeCatalogSource();
		const clock = new FixedClock();
		return { service: new PromotionService(flags, groups, new RevisionWorkflow(flags, catalog, clock, environment), catalog, clock, environment), groups };
	}

	it("exports the live rules with the condition groups they name", async () => {
		const { service } = await setup("staging");
		const file = await service.export(staff(), { kind: "FLAG", key: "web-activity" });
		expect(file).toMatchObject({ formatVersion: 1, environment: "staging", revision: 1, groups: [{ key: "staff" }], listedGroupKeys: [] });
	});

	it("previews a difference and refuses a file from this very environment", async () => {
		const { service } = await setup("staging");
		const file: PromotionFile = await service.export(staff(), { kind: "FLAG", key: "web-activity" });
		expect(await service.preview(staff(), file)).toMatchObject({ identical: true, groups: [{ key: "staff", change: "SAME" }], missingListedGroups: [], needsApproval: false });
		await expect(service.import(staff(), file, "Same environment again")).rejects.toBeInstanceOf(PromotionInvalidError);
	});

	it("imports a file from another environment as a pending revision in production, refusing missing listed groups", async () => {
		const { service } = await setup("production");
		const file: PromotionFile = { ...(await service.export(staff(), { kind: "FLAG", key: "web-activity" })), environment: "staging" };
		await expect(service.import(staff(), { ...file, listedGroupKeys: ["beta"] }, "Needs a listed group")).rejects.toBeInstanceOf(PromotionInvalidError);
		expect(await service.import(staff(), file, "Promoted after review in staging")).toMatchObject({ status: "PENDING", source: "PROMOTION", promotedFrom: "staging" });
	});
});

describe("FlagMaintenanceService", () => {
	it("expires pending revisions and announces a version raised for a scheduled step", async () => {
		const calls: string[] = [];
		const store: FlagMaintenanceStore = {
			expirePending: (at: number) => {
				calls.push(`expire:${String(at)}`);
				return Promise.resolve(2);
			},
			bumpForStepsBetween: (from: number, to: number) => {
				calls.push(`steps:${String(to - from)}`);
				return Promise.resolve(9);
			},
		};
		const catalog = new FakeCatalogSource();
		expect(await new FlagMaintenanceService(store, catalog, new FixedClock()).run()).toStrictEqual({ expired: 2, version: 9 });
		expect(calls).toStrictEqual([`expire:${String(NOW)}`, `steps:${String(SCHEDULE_LOOKBACK_MS)}`]);
		expect(catalog.announced).toStrictEqual([9]);
	});
});
