import { epochMs, type CustomerTier, type Exposure, type PermissionReference } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import type { CatalogFlagRevision } from "../../domain/catalog/flag-catalog";
import { FlagEvaluationService, type BundleRequest } from "../services/flag-evaluation.service";
import { ExposureIntakeService } from "../services/exposure-intake.service";
import { SubjectFactsRegistry } from "../services/subject-facts.registry";
import { FakeCatalogSource, FixedClock, NOW, RecordingExposures } from "./fakes/feature-flag.fakes";

const USER = "019b76da-a800-7000-8000-000000000001";
const TENANT = "019b76da-a800-7000-8000-000000000010";
const LOCATION = "019b76da-a800-7000-8000-000000000020";
const DEVICE = "019b76da-a800-7000-8000-000000000030";
const RULE = "019b76da-a800-7000-8000-0000000000a1";

const REQUEST: BundleRequest = { app: "merchant", userId: USER, tenantId: TENANT, locationId: null, deviceId: DEVICE, platform: "web", appVersion: null, locale: "en" };

function setup(worksAt: boolean): {
	readonly service: FlagEvaluationService;
	readonly catalog: FakeCatalogSource;
	readonly exposures: RecordingExposures;
	readonly asked: string[];
} {
	const catalog = new FakeCatalogSource();
	const facts = new SubjectFactsRegistry();
	const asked: string[] = [];
	facts.register({
		worksAt: (_userId: string, tenantId: string): Promise<boolean> => {
			asked.push(`worksAt:${tenantId}`);
			return Promise.resolve(worksAt);
		},
		emailDomain: (): Promise<string | null> => {
			asked.push("emailDomain");
			return Promise.resolve("rewardhub.test");
		},
	});
	const exposures = new RecordingExposures();
	return { service: new FlagEvaluationService(catalog, facts, exposures, new FixedClock(), "development"), catalog, exposures, asked };
}

describe("FlagEvaluationService", () => {
	it("answers an app only the flags and configs declared for it, with the catalogue version", async () => {
		const { service, catalog } = setup(true);
		catalog.catalog = { ...catalog.catalog, version: 7 };
		const bundle = await service.bundle(REQUEST);
		expect(bundle.version).toBe(7);
		expect(bundle.flags.map((flag) => flag.key)).toStrictEqual(["merchant-analytics"]);
		expect(bundle.configs).toStrictEqual([]);
		const web = await service.bundle({ ...REQUEST, app: "web" });
		expect(web.flags.map((flag) => flag.key)).toStrictEqual(["web-activity"]);
		expect(web.configs.map((config) => config.key)).toStrictEqual(["reward-claim-cta"]);
	});

	it("works a bundle out for the asked-for store only when the person works there", async () => {
		const tenantRule: CatalogFlagRevision = {
			key: "merchant-analytics",
			number: 1,
			rules: [{ id: RULE, name: "This tenant", conditions: [{ attribute: "TENANT_ID", operator: "IN", values: [TENANT] }], rollout: { kind: "FIXED", percentage: 0 } }],
		};
		const member = setup(true);
		member.catalog.catalog = { ...member.catalog.catalog, flagRevisions: [tenantRule] };
		expect((await member.service.bundle(REQUEST)).flags).toMatchObject([{ key: "merchant-analytics", on: false, source: "RULE" }]);
		const stranger = setup(false);
		stranger.catalog.catalog = { ...stranger.catalog.catalog, flagRevisions: [tenantRule] };
		expect((await stranger.service.bundle(REQUEST)).flags).toMatchObject([{ key: "merchant-analytics", on: true, source: "DEFAULT" }]);
		expect((await stranger.service.bundle({ ...REQUEST, userId: null })).flags).toMatchObject([{ source: "DEFAULT" }]);
	});

	it("looks up a person's facts only when a rule reads them", async () => {
		const quiet = setup(true);
		await quiet.service.bundle({ ...REQUEST, tenantId: null });
		expect(quiet.asked).toStrictEqual([]);
		const reading = setup(true);
		reading.catalog.catalog = {
			...reading.catalog.catalog,
			flagRevisions: [
				{
					key: "merchant-analytics",
					number: 1,
					rules: [
						{
							id: RULE,
							name: "Our domain",
							conditions: [{ attribute: "EMAIL_DOMAIN", operator: "IN", values: ["rewardhub.test"] }],
							rollout: { kind: "FIXED", percentage: 0 },
						},
					],
				},
			],
		};
		const bundle = await reading.service.bundle({ ...REQUEST, tenantId: null });
		expect(reading.asked).toStrictEqual(["emailDomain"]);
		expect(bundle.flags).toMatchObject([{ on: false, source: "RULE" }]);
	});

	it("notes an exposure of a server check only when it knows the flag's subject", async () => {
		const { service, exposures } = setup(true);
		expect(await service.isOn("till-redemption", { userId: null, tenantId: TENANT, locationId: LOCATION })).toBe(true);
		expect(exposures.noted).toMatchObject([{ kind: "FLAG", key: "till-redemption", subjectUnit: "LOCATION", subjectId: LOCATION, at: NOW }]);
		await service.isOn("till-redemption", { userId: null, tenantId: TENANT, locationId: null });
		expect(exposures.noted).toHaveLength(1);
	});

	it("explains a check with its trace", async () => {
		const { service, catalog } = setup(true);
		catalog.catalog = { ...catalog.catalog, killSwitches: ["web-activity"] };
		const checked = await service.checkFlag("web-activity", {
			userId: USER,
			tenantId: null,
			locationId: null,
			deviceId: null,
			app: "web",
			platform: "web",
			appVersion: null,
			locale: null,
		});
		expect(checked.result.source).toBe("KILL_SWITCH");
		expect(checked.trace).toMatchObject([{ step: "KILL_SWITCH", matched: true }]);
		const config = await service.checkConfig("reward-claim-cta", {
			userId: USER,
			tenantId: null,
			locationId: null,
			deviceId: null,
			app: "web",
			platform: "web",
			appVersion: null,
			locale: null,
		});
		expect(config.result).toMatchObject({ source: "DEFAULT", value: { emphasis: "standard" } });
	});
});

describe("ExposureIntakeService", () => {
	const flag: Exposure = { kind: "FLAG", key: "web-activity", on: true, source: "RULE", revision: 1, ruleId: null, at: epochMs(NOW) };
	const tenantFlag: Exposure = { ...flag, key: "merchant-analytics" };

	function intake(worksAt: boolean): { readonly service: ExposureIntakeService; readonly recorded: RecordingExposures } {
		const facts = new SubjectFactsRegistry();
		facts.register({ worksAt: (): Promise<boolean> => Promise.resolve(worksAt) });
		const recorded = new RecordingExposures();
		return { service: new ExposureIntakeService(recorded, facts), recorded };
	}

	it("attributes each exposure to the session's person, never to the body", async () => {
		const { service, recorded } = intake(true);
		expect(await service.intake({ userId: USER, deviceId: null }, { app: "web", exposures: [flag] })).toStrictEqual({ accepted: 1, ignored: 0 });
		expect(recorded.batches).toMatchObject([{ app: "web", exposures: [{ subjectUnit: "USER", subjectId: USER }] }]);
	});

	it("ignores a signed-out sender's exposures of anything but device flags, and flags the app never receives", async () => {
		const { service, recorded } = intake(true);
		expect(await service.intake({ userId: null, deviceId: DEVICE }, { app: "web", exposures: [flag] })).toStrictEqual({ accepted: 0, ignored: 1 });
		expect(await service.intake({ userId: USER, deviceId: null }, { app: "admin", exposures: [flag] })).toStrictEqual({ accepted: 0, ignored: 1 });
		expect(recorded.batches).toHaveLength(0);
	});

	it("counts a tenant-unit exposure only for a store the person works at", async () => {
		expect(await intake(true).service.intake({ userId: USER, deviceId: null }, { app: "merchant", tenantId: TENANT, exposures: [tenantFlag] })).toStrictEqual({
			accepted: 1,
			ignored: 0,
		});
		expect(await intake(false).service.intake({ userId: USER, deviceId: null }, { app: "merchant", tenantId: TENANT, exposures: [tenantFlag] })).toStrictEqual({
			accepted: 0,
			ignored: 1,
		});
	});
});

describe("SubjectFactsRegistry", () => {
	it("answers no facts for a signed-out subject, and fails closed when nobody supplies whether a person works at a store", async () => {
		const registry = new SubjectFactsRegistry();
		expect(await registry.resolve(null, new Set(["EMAIL_DOMAIN"]))).toStrictEqual({ emailDomain: null, platformStaff: null, permissions: null, customerTier: null });
		expect(await registry.resolve(USER, new Set(["EMAIL_DOMAIN"]))).toMatchObject({ emailDomain: null });
		expect(await registry.worksAt(USER, TENANT, null)).toBe(false);
		registry.register({
			customerTier: (): Promise<CustomerTier> => Promise.resolve("GOLD"),
			platformStaff: (): Promise<boolean> => Promise.resolve(true),
			permissions: (): Promise<readonly PermissionReference[]> => Promise.resolve([]),
		});
		expect(await registry.resolve(USER, new Set(["CUSTOMER_TIER", "PLATFORM_STAFF", "PERMISSION"]))).toStrictEqual({
			emailDomain: null,
			platformStaff: true,
			permissions: [],
			customerTier: "GOLD",
		});
	});
});
