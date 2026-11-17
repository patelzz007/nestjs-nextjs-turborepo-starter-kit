import type { ConfigRevisionContent, DeploymentEnvironment, FlagRule } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import {
	FlagOverrideNotFoundError,
	FlagRevisionConflictError,
	FlagRulesInvalidError,
	FlagSelfApprovalError,
	FlagSubjectNotFoundError,
} from "../../domain/errors/feature-flag.errors";
import { ConfigAdminService } from "../services/config-admin.service";
import { FlagAdminService } from "../services/flag-admin.service";
import { RevisionWorkflow } from "../services/revision-workflow";
import type { ExperimentStore } from "../ports/experiment.store";
import { FakeCatalogSource, FixedClock, InMemoryFlagAdminStore, NOW, OTHER_STAFF_ID, staff } from "./fakes/feature-flag.fakes";

const RULE = "019b76da-a800-7000-8000-0000000000a1";
const SUBJECT = "019b76da-a800-7000-8000-000000000001";
const WEEK_MS = 604_800_000;
const EVERYONE: FlagRule = { id: RULE, name: "Everyone", conditions: [], rollout: { kind: "FIXED", percentage: 100 } };

const NO_EXPERIMENTS: ExperimentStore = {
	list: () => Promise.resolve([]),
	find: () => Promise.resolve(null),
	results: (_actor, experimentId) => Promise.resolve({ experimentId, computedAt: null, results: [] }),
	create: () => Promise.resolve(null),
	update: () => Promise.resolve({ kind: "NOT_FOUND" }),
	start: () => Promise.resolve({ kind: "NOT_FOUND" }),
	stop: () => Promise.resolve({ kind: "NOT_FOUND" }),
};

function setup(environment: DeploymentEnvironment = "development"): {
	readonly flags: FlagAdminService;
	readonly configs: ConfigAdminService;
	readonly store: InMemoryFlagAdminStore;
	readonly catalog: FakeCatalogSource;
} {
	const store = new InMemoryFlagAdminStore();
	const catalog = new FakeCatalogSource();
	const clock = new FixedClock();
	const workflow = new RevisionWorkflow(store, catalog, clock, environment);
	return {
		flags: new FlagAdminService(store, workflow, catalog, clock, environment),
		configs: new ConfigAdminService(store, NO_EXPERIMENTS, workflow, clock),
		store,
		catalog,
	};
}

describe("FlagAdminService and its revision workflow", () => {
	it("puts a save live at once outside production, and announces the new version", async () => {
		const { flags, catalog } = setup();
		const saved = await flags.saveRevision(staff(), "web-activity", { rules: [EVERYONE], reason: "Everyone gets it", basedOn: null });
		expect(saved).toMatchObject({ number: 1, status: "LIVE", source: "CONSOLE" });
		expect(catalog.announced).toStrictEqual([1]);
		expect(flags.environmentInfo()).toStrictEqual({ environment: "development", approvalsRequired: false });
	});

	it("refuses a save based on a revision that's no longer live", async () => {
		const { flags } = setup();
		await flags.saveRevision(staff(), "web-activity", { rules: [], reason: "First change", basedOn: null });
		await expect(flags.saveRevision(staff(), "web-activity", { rules: [], reason: "Based on nothing", basedOn: null })).rejects.toBeInstanceOf(FlagRevisionConflictError);
	});

	it("in production, keeps a save pending for a week until someone else approves it", async () => {
		const { flags, catalog } = setup("production");
		const pending = await flags.saveRevision(staff(), "web-activity", { rules: [EVERYONE], reason: "Everyone gets it", basedOn: null });
		expect(pending).toMatchObject({ status: "PENDING", expiresAt: NOW + WEEK_MS });
		expect(catalog.announced).toStrictEqual([]);
		await expect(flags.saveRevision(staff(), "web-activity", { rules: [], reason: "A second proposal", basedOn: null })).rejects.toBeInstanceOf(FlagRulesInvalidError);
		await expect(flags.decideRevision(staff(), "web-activity", pending.number, { decision: "APPROVE", reason: "Looks right to me" })).rejects.toBeInstanceOf(
			FlagSelfApprovalError,
		);
		const approved = await flags.decideRevision(staff(OTHER_STAFF_ID), "web-activity", pending.number, { decision: "APPROVE", reason: "Reviewed the rules" });
		expect(approved.status).toBe("LIVE");
		expect(catalog.announced).toStrictEqual([1]);
	});

	it("rejects a pending change without changing what's live", async () => {
		const { flags, catalog } = setup("production");
		const pending = await flags.saveRevision(staff(), "web-activity", { rules: [], reason: "Remove every rule", basedOn: null });
		const rejected = await flags.decideRevision(staff(OTHER_STAFF_ID), "web-activity", pending.number, { decision: "REJECT", reason: "Not this week" });
		expect(rejected).toMatchObject({ status: "REJECTED", decisionReason: "Not this week" });
		expect(catalog.announced).toStrictEqual([]);
	});

	it("refuses rules naming a group that doesn't exist", async () => {
		const { flags, store } = setup();
		const grouped: FlagRule = { ...EVERYONE, conditions: [{ attribute: "FLAG_GROUP", operator: "IN_GROUP", groupKey: "beta" }] };
		await expect(flags.saveRevision(staff(), "web-activity", { rules: [grouped], reason: "Beta testers only", basedOn: null })).rejects.toBeInstanceOf(FlagRulesInvalidError);
		store.groups = new Set(["beta"]);
		await expect(flags.saveRevision(staff(), "web-activity", { rules: [grouped], reason: "Beta testers only", basedOn: null })).resolves.toMatchObject({ status: "LIVE" });
	});

	it("throws a kill switch at once, even in production, and announces it", async () => {
		const { flags, catalog } = setup("production");
		expect(await flags.setKillSwitch(staff(), "web-activity", { on: true, reason: "The page is broken" })).toMatchObject({ on: true });
		expect(catalog.announced).toStrictEqual([1]);
		const list = await flags.list(staff());
		expect(list.flags.find((flag) => flag.key === "web-activity")?.killSwitch.on).toBe(true);
	});

	it("sets and removes overrides, refusing a subject that doesn't exist and an override already gone", async () => {
		const { flags, store } = setup();
		await expect(flags.setOverride(staff(), "web-activity", { unit: "USER", subjectId: SUBJECT, on: true, reason: "QA account" })).rejects.toBeInstanceOf(
			FlagSubjectNotFoundError,
		);
		store.subjects = new Set([SUBJECT]);
		const override = await flags.setOverride(staff(), "web-activity", { unit: "USER", subjectId: SUBJECT, on: true, reason: "QA account" });
		expect((await flags.detail(staff(), "web-activity")).overrides).toHaveLength(1);
		await flags.removeOverride(staff(), "web-activity", override.id);
		await expect(flags.removeOverride(staff(), "web-activity", override.id)).rejects.toBeInstanceOf(FlagOverrideNotFoundError);
		expect((await flags.searchSubjects(staff(), { unit: "USER" })).subjects).toHaveLength(1);
	});

	it("lists every declared flag with its live rules, counts and the ready-to-remove badge", async () => {
		const { flags, store } = setup();
		store.totals = new Map([["web-activity", { count: 12, lastAt: NOW }]]);
		await flags.saveRevision(staff(), "web-activity", { rules: [EVERYONE], reason: "Everyone gets it", basedOn: null });
		const list = await flags.list(staff());
		expect(list.flags).toHaveLength(7);
		expect(list.flags.find((flag) => flag.key === "web-activity")).toMatchObject({ liveRevision: 1, ruleCount: 1, exposures24h: 12, readyToRemove: null });
		expect((await flags.revisions(staff(), "web-activity")).revisions).toHaveLength(1);
	});
});

describe("ConfigAdminService", () => {
	const content: ConfigRevisionContent = { kind: "CONFIG", values: [{ name: "bold", value: { emphasis: "bold" } }], rules: [] };

	it("saves values that fit the declared shape, and lists the config with them", async () => {
		const { configs } = setup();
		await configs.saveRevision(staff(), "reward-claim-cta", { content, reason: "Add the bold style", basedOn: null });
		const list = await configs.list(staff());
		expect(list.configs).toMatchObject([{ key: "reward-claim-cta", liveRevision: 1, valueCount: 1, ruleCount: 0, runningExperimentId: null }]);
		const [config] = list.configs;
		expect(config?.valueJsonSchema).toMatchObject({ type: "object" });
		expect((await configs.detail(staff(), "reward-claim-cta")).live?.number).toBe(1);
		expect((await configs.revisions(staff(), "reward-claim-cta")).revisions).toHaveLength(1);
	});

	it("refuses a value that doesn't fit", async () => {
		const { configs } = setup();
		const invalid: ConfigRevisionContent = { ...content, values: [{ name: "neon", value: { emphasis: "neon" } }] };
		await expect(configs.saveRevision(staff(), "reward-claim-cta", { content: invalid, reason: "A style that doesn't exist", basedOn: null })).rejects.toBeInstanceOf(
			FlagRulesInvalidError,
		);
	});

	it("decides a pending config change in production", async () => {
		const { configs } = setup("production");
		const pending = await configs.saveRevision(staff(), "reward-claim-cta", { content, reason: "Add the bold style", basedOn: null });
		expect((await configs.decideRevision(staff(OTHER_STAFF_ID), "reward-claim-cta", pending.number, { decision: "APPROVE", reason: "Design approved it" })).status).toBe(
			"LIVE",
		);
	});
});
