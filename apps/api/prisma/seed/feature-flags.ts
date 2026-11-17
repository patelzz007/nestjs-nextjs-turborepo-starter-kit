// Feature flags v2 (ADR 086, ADR 087): a believable history for every flag, config, group and experiment, with every
// column filled. Values never change what a flag answers out of the box (every seeded rule keeps its flag on where its
// code default is on), except the component showcase, which a rule turns on outside production — what
// `ADMIN_SHOWCASE` used to decide.
//
// Revisions: showcase 1 (superseded) → 2 (live, environment rule) → 3 (rejected); till-redemption 1 (live, pilot
// stores first then everyone); merchant-analytics 1 (live, a finished scheduled rollout); web-activity 1 (live,
// beta testers then everyone) + 2 (expired); mobile-analytics 1 (live, promoted from staging) + 2 (pending, waiting
// for someone other than its author); reward-claim-cta 1 (live: standard and bold values).

import {
	epochMs,
	ConfigRevisionContentSchema,
	FlagGroupConditionsSchema,
	FlagRevisionContentSchema,
	type ConfigRevisionContent,
	type Condition,
	type FlagRevisionContent,
} from "@workspace/shared";
import type { Prisma } from "@prisma/client";

import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { TENANT_SEED_IDS } from "./tenant-seed-ids";

const NAMESPACE = "feature-flags-v2";
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const EVERYONE = 100;
const PENDING_WEEK_DAYS = 7;

function id(key: string): string {
	return deterministicUuid(NAMESPACE, key);
}

function ruleId(key: string): string {
	return deterministicUuid(`${NAMESPACE}:rule`, key);
}

interface SeedPeople {
	readonly superAdmin: string;
	readonly admin: string;
	readonly developer: string;
	readonly betaTesters: readonly string[];
}

async function people(): Promise<SeedPeople> {
	const byEmail = async (email: string): Promise<string> => (await prisma.user.findFirstOrThrow({ where: { email, isDeleted: false }, select: { id: true } })).id;
	return {
		superAdmin: await byEmail("superadmin@example.com"),
		admin: await byEmail("admin@example.com"),
		developer: await byEmail("developer@example.com"),
		betaTesters: await Promise.all(["alice.johnson@example.com", "bob.smith@example.com", "carol.white@example.com", "user@example.com"].map(byEmail)),
	};
}

const STAFF_CONDITIONS: Condition[] = [{ attribute: "PLATFORM_STAFF", is: true }];

function flagContent(content: FlagRevisionContent): Prisma.InputJsonValue {
	return FlagRevisionContentSchema.parse(content);
}

function configContent(content: ConfigRevisionContent): Prisma.InputJsonValue {
	return ConfigRevisionContentSchema.parse(content);
}

async function seedGroups(now: number, who: SeedPeople): Promise<number> {
	const groups: Prisma.FlagGroupUncheckedCreateInput[] = [
		{
			id: id("group:beta-testers"),
			key: "beta-testers",
			name: "Beta testers",
			description: "Customers who asked to try new screens before everyone else.",
			kind: "LIST",
			unit: "USER",
			reason: "Customers who signed up for the beta programme",
			createdBy: who.admin,
			updatedBy: who.admin,
			createdAt: BigInt(now - 30 * DAY_MS),
			updatedAt: BigInt(now - 5 * DAY_MS),
		},
		{
			id: id("group:platform-staff"),
			key: "platform-staff",
			name: "Platform staff",
			description: "Everyone who can open the admin console.",
			kind: "CONDITIONS",
			conditions: FlagGroupConditionsSchema.parse(STAFF_CONDITIONS),
			reason: "Staff try every change first",
			createdBy: who.superAdmin,
			updatedBy: who.superAdmin,
			createdAt: BigInt(now - 40 * DAY_MS),
			updatedAt: BigInt(now - 40 * DAY_MS),
		},
		{
			id: id("group:pilot-stores"),
			key: "pilot-stores",
			name: "Pilot stores",
			description: "Branches that take new till features first.",
			kind: "LIST",
			unit: "LOCATION",
			reason: "The two Melaka branches pilot till changes",
			createdBy: who.developer,
			updatedBy: who.developer,
			createdAt: BigInt(now - 20 * DAY_MS),
			updatedAt: BigInt(now - 20 * DAY_MS),
		},
		{
			id: id("group:old-pilot"),
			key: "old-pilot",
			name: "Old pilot",
			description: "The first pilot, before the Melaka branches.",
			kind: "LIST",
			unit: "TENANT",
			reason: "Replaced by the pilot stores group",
			createdBy: who.developer,
			updatedBy: who.superAdmin,
			createdAt: BigInt(now - 60 * DAY_MS),
			updatedAt: BigInt(now - 21 * DAY_MS),
			isDeleted: true,
			deletedAt: BigInt(now - 21 * DAY_MS),
			deletedBy: who.superAdmin,
		},
	];
	for (const group of groups) {
		await prisma.flagGroup.upsert({ where: { id: group.id ?? "" }, update: {}, create: group });
	}
	const members: Prisma.FlagGroupMemberUncheckedCreateInput[] = [
		...who.betaTesters.map((userId, index) => ({
			id: id(`member:beta:${String(index)}`),
			groupId: id("group:beta-testers"),
			subjectId: userId,
			createdBy: who.admin,
			updatedBy: who.admin,
			createdAt: BigInt(now - (20 - index) * DAY_MS),
			updatedAt: BigInt(now - (20 - index) * DAY_MS),
		})),
		{
			id: id("member:pilot:katil"),
			groupId: id("group:pilot-stores"),
			subjectId: TENANT_SEED_IDS.mlkLocationKatil,
			createdBy: who.developer,
			updatedBy: who.developer,
			createdAt: BigInt(now - 20 * DAY_MS),
			updatedAt: BigInt(now - 20 * DAY_MS),
		},
		{
			id: id("member:pilot:beruang"),
			groupId: id("group:pilot-stores"),
			subjectId: TENANT_SEED_IDS.mlkLocationBeruang,
			createdBy: who.developer,
			updatedBy: who.developer,
			createdAt: BigInt(now - 20 * DAY_MS),
			updatedAt: BigInt(now - 20 * DAY_MS),
		},
		{
			id: id("member:pilot:kl:removed"),
			groupId: id("group:pilot-stores"),
			subjectId: TENANT_SEED_IDS.klLocation,
			createdBy: who.developer,
			updatedBy: who.developer,
			createdAt: BigInt(now - 20 * DAY_MS),
			updatedAt: BigInt(now - 12 * DAY_MS),
			isDeleted: true,
			deletedAt: BigInt(now - 12 * DAY_MS),
			deletedBy: who.developer,
		},
		{
			id: id("member:old-pilot:kl"),
			groupId: id("group:old-pilot"),
			subjectId: TENANT_SEED_IDS.klTenant,
			createdBy: who.developer,
			updatedBy: who.superAdmin,
			createdAt: BigInt(now - 60 * DAY_MS),
			updatedAt: BigInt(now - 21 * DAY_MS),
			isDeleted: true,
			deletedAt: BigInt(now - 21 * DAY_MS),
			deletedBy: who.superAdmin,
		},
	];
	for (const member of members) {
		await prisma.flagGroupMember.upsert({ where: { id: member.id ?? "" }, update: {}, create: member });
	}
	return groups.length + members.length;
}

function revisions(now: number, who: SeedPeople): Prisma.FlagRevisionUncheckedCreateInput[] {
	const everyone = (name: string, key: string): FlagRevisionContent["rules"][number] => ({
		id: ruleId(key),
		name,
		conditions: [],
		rollout: { kind: "FIXED", percentage: EVERYONE },
	});
	return [
		{
			id: id("rev:showcase:1"),
			kind: "FLAG",
			key: "showcase",
			number: 1,
			status: "SUPERSEDED",
			content: flagContent({
				kind: "FLAG",
				rules: [
					{
						id: ruleId("showcase:staff-half"),
						name: "Half of the staff",
						conditions: [{ attribute: "FLAG_GROUP", operator: "IN_GROUP", groupKey: "platform-staff" }],
						rollout: { kind: "FIXED", percentage: 50 },
					},
				],
			}),
			reason: "Trying the showcase with half of the staff first",
			source: "CONSOLE",
			promotedFrom: null,
			authorUserId: who.developer,
			decidedAt: BigInt(now - 14 * DAY_MS),
			decidedByUserId: who.developer,
			decisionReason: null,
			expiresAt: null,
			createdBy: who.developer,
			updatedBy: who.developer,
			createdAt: BigInt(now - 14 * DAY_MS),
			updatedAt: BigInt(now - 7 * DAY_MS),
		},
		{
			id: id("rev:showcase:2"),
			kind: "FLAG",
			key: "showcase",
			number: 2,
			status: "LIVE",
			content: flagContent({
				kind: "FLAG",
				rules: [
					{
						id: ruleId("showcase:outside-production"),
						name: "Every build except production",
						conditions: [{ attribute: "ENVIRONMENT", operator: "IN", values: ["development", "staging"] }],
						rollout: { kind: "FIXED", percentage: EVERYONE },
					},
				],
			}),
			reason: "The showcase is a developer tool: on in every build except production, as ADMIN_SHOWCASE used to decide",
			source: "SEED",
			promotedFrom: null,
			authorUserId: who.superAdmin,
			decidedAt: BigInt(now - 7 * DAY_MS),
			decidedByUserId: who.superAdmin,
			decisionReason: "Replaces the half-of-staff trial",
			expiresAt: null,
			createdBy: who.superAdmin,
			updatedBy: who.superAdmin,
			createdAt: BigInt(now - 7 * DAY_MS),
			updatedAt: BigInt(now - 7 * DAY_MS),
		},
		{
			id: id("rev:showcase:3"),
			kind: "FLAG",
			key: "showcase",
			number: 3,
			status: "REJECTED",
			content: flagContent({ kind: "FLAG", rules: [everyone("Everyone, production too", "showcase:everyone")] }),
			reason: "Show the showcase in production as well",
			source: "CONSOLE",
			promotedFrom: null,
			authorUserId: who.developer,
			decidedAt: BigInt(now - 6 * DAY_MS),
			decidedByUserId: who.superAdmin,
			decisionReason: "The showcase isn't part of the product: keep it out of production",
			expiresAt: BigInt(now - 6 * DAY_MS + PENDING_WEEK_DAYS * DAY_MS),
			createdBy: who.developer,
			updatedBy: who.superAdmin,
			createdAt: BigInt(now - 6 * DAY_MS - HOUR_MS),
			updatedAt: BigInt(now - 6 * DAY_MS),
		},
		{
			id: id("rev:till-redemption:1"),
			kind: "FLAG",
			key: "till-redemption",
			number: 1,
			status: "LIVE",
			content: flagContent({
				kind: "FLAG",
				rules: [
					{
						id: ruleId("till:pilot"),
						name: "Pilot stores",
						conditions: [{ attribute: "FLAG_GROUP", operator: "IN_GROUP", groupKey: "pilot-stores" }],
						rollout: { kind: "FIXED", percentage: EVERYONE },
					},
					everyone("Every other store", "till:everyone"),
				],
			}),
			reason: "Pilot stores first, then every store, so a till change can be held back for the rest",
			source: "CONSOLE",
			promotedFrom: null,
			authorUserId: who.developer,
			decidedAt: BigInt(now - 18 * DAY_MS),
			decidedByUserId: who.developer,
			decisionReason: null,
			expiresAt: null,
			createdBy: who.developer,
			updatedBy: who.developer,
			createdAt: BigInt(now - 18 * DAY_MS),
			updatedAt: BigInt(now - 18 * DAY_MS),
		},
		{
			id: id("rev:merchant-analytics:1"),
			kind: "FLAG",
			key: "merchant-analytics",
			number: 1,
			status: "LIVE",
			content: flagContent({
				kind: "FLAG",
				rules: [
					{
						id: ruleId("merchant-analytics:ramp"),
						name: "Ramp to every merchant",
						conditions: [],
						rollout: {
							kind: "SCHEDULED",
							steps: [
								{ at: epochMs(now - 10 * DAY_MS), percentage: 10 },
								{ at: epochMs(now - 7 * DAY_MS), percentage: 50 },
								{ at: epochMs(now - 4 * DAY_MS), percentage: EVERYONE },
							],
						},
					},
				],
			}),
			reason: "Ten per cent of merchants, then half, then everyone, over a week",
			source: "CONSOLE",
			promotedFrom: null,
			authorUserId: who.admin,
			decidedAt: BigInt(now - 11 * DAY_MS),
			decidedByUserId: who.admin,
			decisionReason: null,
			expiresAt: null,
			createdBy: who.admin,
			updatedBy: who.admin,
			createdAt: BigInt(now - 11 * DAY_MS),
			updatedAt: BigInt(now - 11 * DAY_MS),
		},
		{
			id: id("rev:web-activity:1"),
			kind: "FLAG",
			key: "web-activity",
			number: 1,
			status: "LIVE",
			content: flagContent({
				kind: "FLAG",
				rules: [
					{
						id: ruleId("web-activity:beta"),
						name: "Beta testers",
						conditions: [{ attribute: "FLAG_GROUP", operator: "IN_GROUP", groupKey: "beta-testers" }],
						rollout: { kind: "FIXED", percentage: EVERYONE },
					},
					everyone("Everyone else", "web-activity:everyone"),
				],
			}),
			reason: "Beta testers first; everyone else since the review",
			source: "CONSOLE",
			promotedFrom: null,
			authorUserId: who.admin,
			decidedAt: BigInt(now - 9 * DAY_MS),
			decidedByUserId: who.admin,
			decisionReason: null,
			expiresAt: null,
			createdBy: who.admin,
			updatedBy: who.admin,
			createdAt: BigInt(now - 9 * DAY_MS),
			updatedAt: BigInt(now - 9 * DAY_MS),
		},
		{
			id: id("rev:web-activity:2"),
			kind: "FLAG",
			key: "web-activity",
			number: 2,
			status: "EXPIRED",
			content: flagContent({ kind: "FLAG", rules: [everyone("Everyone", "web-activity:everyone")] }),
			reason: "Drop the beta testers rule now that everyone has it",
			source: "CONSOLE",
			promotedFrom: null,
			authorUserId: who.developer,
			decidedAt: BigInt(now - DAY_MS),
			decidedByUserId: null,
			decisionReason: null,
			expiresAt: BigInt(now - DAY_MS),
			createdBy: who.developer,
			updatedBy: who.developer,
			createdAt: BigInt(now - 8 * DAY_MS),
			updatedAt: BigInt(now - DAY_MS),
		},
		{
			id: id("rev:mobile-analytics:1"),
			kind: "FLAG",
			key: "mobile-analytics",
			number: 1,
			status: "LIVE",
			content: flagContent({
				kind: "FLAG",
				rules: [
					{
						id: ruleId("mobile-analytics:new-apps"),
						name: "App 1.0.0 and later",
						conditions: [{ attribute: "APP_VERSION", operator: "AT_LEAST", version: "1.0.0" }],
						rollout: { kind: "FIXED", percentage: EVERYONE },
					},
				],
			}),
			reason: "Promoted from staging after the tab passed review there",
			source: "PROMOTION",
			promotedFrom: "staging",
			authorUserId: who.superAdmin,
			decidedAt: BigInt(now - 5 * DAY_MS),
			decidedByUserId: who.superAdmin,
			decisionReason: null,
			expiresAt: null,
			createdBy: who.superAdmin,
			updatedBy: who.superAdmin,
			createdAt: BigInt(now - 5 * DAY_MS),
			updatedAt: BigInt(now - 5 * DAY_MS),
		},
		{
			id: id("rev:mobile-analytics:2"),
			kind: "FLAG",
			key: "mobile-analytics",
			number: 2,
			status: "PENDING",
			content: flagContent({
				kind: "FLAG",
				rules: [
					{
						id: ruleId("mobile-analytics:ios-first"),
						name: "iOS first",
						conditions: [{ attribute: "PLATFORM", operator: "IN", values: ["ios"] }],
						rollout: { kind: "FIXED", percentage: EVERYONE },
					},
					{
						id: ruleId("mobile-analytics:everyone"),
						name: "Then everyone",
						conditions: [{ attribute: "TIME", from: epochMs(now + 3 * DAY_MS), until: null }],
						rollout: { kind: "FIXED", percentage: EVERYONE },
					},
				],
			}),
			reason: "Show the tab on iOS first, everyone from Thursday",
			source: "CONSOLE",
			promotedFrom: null,
			authorUserId: who.developer,
			decidedAt: null,
			decidedByUserId: null,
			decisionReason: null,
			expiresAt: BigInt(now + 5 * DAY_MS),
			createdBy: who.developer,
			updatedBy: who.developer,
			createdAt: BigInt(now - 2 * DAY_MS),
			updatedAt: BigInt(now - 2 * DAY_MS),
		},
		{
			id: id("rev:reward-claim-cta:1"),
			kind: "CONFIG",
			key: "reward-claim-cta",
			number: 1,
			status: "LIVE",
			content: configContent({
				kind: "CONFIG",
				values: [
					{ name: "standard", value: { emphasis: "standard" } },
					{ name: "bold", value: { emphasis: "bold" } },
				],
				rules: [
					{
						id: ruleId("cta:staff-bold"),
						name: "Staff see the bold button",
						conditions: [{ attribute: "FLAG_GROUP", operator: "IN_GROUP", groupKey: "platform-staff" }],
						rollout: { kind: "FIXED", percentage: EVERYONE },
						valueName: "bold",
					},
				],
			}),
			reason: "The two button styles the claim experiment compares",
			source: "CONSOLE",
			promotedFrom: null,
			authorUserId: who.admin,
			decidedAt: BigInt(now - 12 * DAY_MS),
			decidedByUserId: who.admin,
			decisionReason: null,
			expiresAt: null,
			createdBy: who.admin,
			updatedBy: who.admin,
			createdAt: BigInt(now - 12 * DAY_MS),
			updatedAt: BigInt(now - 12 * DAY_MS),
		},
	];
}

async function seedOverridesAndKillSwitches(now: number, who: SeedPeople): Promise<number> {
	const overrides: Prisma.FeatureFlagOverrideUncheckedCreateInput[] = [
		{
			id: id("override:till:jonker"),
			key: "till-redemption",
			unit: "TENANT",
			tenantId: TENANT_SEED_IDS.mlkTenant,
			isOn: true,
			reason: "Every Jonker Street Kitchen branch redeems at its tills",
			createdBy: who.superAdmin,
			updatedBy: who.superAdmin,
			createdAt: BigInt(now - 10 * DAY_MS),
			updatedAt: BigInt(now - 10 * DAY_MS),
		},
		{
			id: id("override:till:katil:earlier"),
			key: "till-redemption",
			unit: "LOCATION",
			locationId: TENANT_SEED_IDS.mlkLocationKatil,
			isOn: false,
			reason: "Bukit Katil's till was being repaired",
			createdBy: who.developer,
			updatedBy: who.developer,
			createdAt: BigInt(now - 9 * DAY_MS),
			updatedAt: BigInt(now - 6 * DAY_MS),
			isDeleted: true,
			deletedAt: BigInt(now - 6 * DAY_MS),
			deletedBy: who.superAdmin,
		},
		{
			id: id("override:till:katil"),
			key: "till-redemption",
			unit: "LOCATION",
			locationId: TENANT_SEED_IDS.mlkLocationKatil,
			isOn: false,
			reason: "Bukit Katil's tills are being replaced this week",
			createdBy: who.superAdmin,
			updatedBy: who.superAdmin,
			createdAt: BigInt(now - 2 * DAY_MS),
			updatedAt: BigInt(now - 2 * DAY_MS),
		},
		{
			id: id("override:web-activity:developer"),
			key: "web-activity",
			unit: "USER",
			userId: who.developer,
			isOn: true,
			reason: "The developer checks the activity page while it's still behind beta testers elsewhere",
			createdBy: who.admin,
			updatedBy: who.admin,
			createdAt: BigInt(now - 4 * DAY_MS),
			updatedAt: BigInt(now - 4 * DAY_MS),
		},
	];
	for (const row of overrides) {
		// One live override per flag and subject: one someone has since set (a test, an admin) keeps theirs.
		const taken =
			row.isDeleted !== true &&
			(await prisma.featureFlagOverride.findFirst({
				where: {
					key: row.key,
					unit: row.unit,
					userId: row.userId ?? null,
					locationId: row.locationId ?? null,
					tenantId: row.tenantId ?? null,
					isDeleted: false,
					NOT: { id: row.id ?? "" },
				},
				select: { id: true },
			})) !== null;
		if (!taken) {
			await prisma.featureFlagOverride.upsert({ where: { id: row.id ?? "" }, update: {}, create: row });
		}
	}
	const killSwitches: Prisma.FeatureFlagKillSwitchUncheckedCreateInput[] = [
		{
			id: id("kill:merchant-invites"),
			key: "merchant-invites",
			isOn: false,
			reason: "Released: the invite emails are going out again after the mail provider's outage",
			createdBy: who.superAdmin,
			updatedBy: who.admin,
			createdAt: BigInt(now - 3 * DAY_MS),
			updatedAt: BigInt(now - 2 * DAY_MS),
		},
		{
			id: id("kill:customer-tiers:old"),
			key: "customer-tiers",
			isOn: false,
			reason: "Released after the nightly review was fixed",
			createdBy: who.superAdmin,
			updatedBy: who.superAdmin,
			createdAt: BigInt(now - 25 * DAY_MS),
			updatedAt: BigInt(now - 24 * DAY_MS),
			isDeleted: true,
			deletedAt: BigInt(now - 24 * DAY_MS),
			deletedBy: who.superAdmin,
		},
	];
	for (const row of killSwitches) {
		const taken =
			row.isDeleted !== true &&
			(await prisma.featureFlagKillSwitch.findFirst({ where: { key: row.key, isDeleted: false, NOT: { id: row.id ?? "" } }, select: { id: true } })) !== null;
		if (!taken) {
			await prisma.featureFlagKillSwitch.upsert({ where: { id: row.id ?? "" }, update: {}, create: row });
		}
	}
	return overrides.length + killSwitches.length;
}

async function seedExperiments(now: number, who: SeedPeople): Promise<number> {
	const experiments: Prisma.ExperimentUncheckedCreateInput[] = [
		{
			id: id("experiment:claim-emphasis"),
			key: "claim-button-emphasis",
			configKey: "reward-claim-cta",
			name: "Bold claim button",
			hypothesis: "A bolder Claim button leads more people to claim the rewards they open.",
			status: "RUNNING",
			trafficPercentage: 50,
			variants: [
				{ valueName: "standard", allocation: 50 },
				{ valueName: "bold", allocation: 50 },
			],
			controlValueName: "standard",
			primaryMetric: "reward-claims",
			guardrailMetrics: ["reward-redemptions"],
			salt: "5eed0c1a1m0b01d0",
			plannedEndAt: BigInt(now + 14 * DAY_MS),
			startedAt: BigInt(now - 6 * DAY_MS),
			stoppedAt: null,
			conclusion: null,
			reason: "Start after the design review",
			createdBy: who.admin,
			updatedBy: who.admin,
			createdAt: BigInt(now - 8 * DAY_MS),
			updatedAt: BigInt(now - 6 * DAY_MS),
		},
		{
			id: id("experiment:claim-emphasis-pilot"),
			key: "claim-button-pilot",
			configKey: "reward-claim-cta",
			name: "Bold claim button (pilot)",
			hypothesis: "The bold button works for staff before customers see it.",
			status: "STOPPED",
			trafficPercentage: 100,
			variants: [
				{ valueName: "standard", allocation: 50 },
				{ valueName: "bold", allocation: 50 },
			],
			controlValueName: "standard",
			primaryMetric: "reward-claims",
			guardrailMetrics: ["sign-ins"],
			salt: "5eed0c1a1mp1l0t0",
			plannedEndAt: BigInt(now - 9 * DAY_MS),
			startedAt: BigInt(now - 16 * DAY_MS),
			stoppedAt: BigInt(now - 9 * DAY_MS),
			conclusion: "No difference among staff; the full experiment runs on customers.",
			reason: "Pilot finished",
			createdBy: who.admin,
			updatedBy: who.admin,
			createdAt: BigInt(now - 17 * DAY_MS),
			updatedAt: BigInt(now - 9 * DAY_MS),
		},
		{
			id: id("experiment:claim-emphasis-next"),
			key: "claim-button-mobile",
			configKey: "reward-claim-cta",
			name: "Bold claim button on mobile",
			hypothesis: "The mobile app benefits more from the bold button than the web.",
			status: "DRAFT",
			trafficPercentage: 30,
			variants: [
				{ valueName: "standard", allocation: 70 },
				{ valueName: "bold", allocation: 30 },
			],
			controlValueName: "standard",
			primaryMetric: "reward-claims",
			guardrailMetrics: [],
			salt: "5eed0c1a1mm0b1e0",
			plannedEndAt: null,
			startedAt: null,
			stoppedAt: null,
			conclusion: null,
			reason: "Planned for after the current experiment",
			createdBy: who.developer,
			updatedBy: who.developer,
			createdAt: BigInt(now - DAY_MS),
			updatedAt: BigInt(now - DAY_MS),
		},
	];
	for (const row of experiments) {
		await prisma.experiment.upsert({ where: { id: row.id ?? "" }, update: {}, create: row });
	}
	const results: Prisma.ExperimentResultUncheckedCreateInput[] = [
		{
			id: id("result:claims:standard"),
			experimentId: id("experiment:claim-emphasis"),
			metric: "reward-claims",
			valueName: "standard",
			subjects: 412,
			mean: 1.84,
			delta: null,
			ciLow: null,
			ciHigh: null,
			significant: false,
			computedAt: BigInt(now - HOUR_MS),
		},
		{
			id: id("result:claims:bold"),
			experimentId: id("experiment:claim-emphasis"),
			metric: "reward-claims",
			valueName: "bold",
			subjects: 398,
			mean: 2.11,
			delta: 0.27,
			ciLow: 0.08,
			ciHigh: 0.46,
			significant: true,
			computedAt: BigInt(now - HOUR_MS),
		},
		{
			id: id("result:redemptions:standard"),
			experimentId: id("experiment:claim-emphasis"),
			metric: "reward-redemptions",
			valueName: "standard",
			subjects: 412,
			mean: 0.93,
			delta: null,
			ciLow: null,
			ciHigh: null,
			significant: false,
			computedAt: BigInt(now - HOUR_MS),
		},
		{
			id: id("result:redemptions:bold"),
			experimentId: id("experiment:claim-emphasis"),
			metric: "reward-redemptions",
			valueName: "bold",
			subjects: 398,
			mean: 0.97,
			delta: 0.04,
			ciLow: -0.09,
			ciHigh: 0.17,
			significant: false,
			computedAt: BigInt(now - HOUR_MS),
		},
		{
			id: id("result:pilot:standard"),
			experimentId: id("experiment:claim-emphasis-pilot"),
			metric: "reward-claims",
			valueName: "standard",
			subjects: 6,
			mean: 1.5,
			delta: null,
			ciLow: null,
			ciHigh: null,
			significant: false,
			computedAt: BigInt(now - 9 * DAY_MS),
		},
		{
			id: id("result:pilot:bold"),
			experimentId: id("experiment:claim-emphasis-pilot"),
			metric: "reward-claims",
			valueName: "bold",
			subjects: 5,
			mean: 1.6,
			delta: 0.1,
			ciLow: -1.2,
			ciHigh: 1.4,
			significant: false,
			computedAt: BigInt(now - 9 * DAY_MS),
		},
	];
	for (const row of results) {
		await prisma.experimentResult.upsert({ where: { id: row.id ?? "" }, update: {}, create: row });
	}
	return experiments.length + results.length;
}

/** A week of exposures (and older daily sums), so the flag pages show counts and the stale badge has data. */
async function seedExposures(now: number, who: SeedPeople): Promise<number> {
	const exposures: Prisma.FeatureFlagExposureUncheckedCreateInput[] = [];
	const users = [who.developer, who.admin, ...who.betaTesters];
	for (let day = 0; day < 7; day += 1) {
		users.forEach((userId, index) => {
			const at = BigInt(now - day * DAY_MS - index * HOUR_MS);
			const eventId = id(`exposure-event:${String(day)}:${String(index)}`);
			exposures.push(
				{
					id: id(`exposure:${String(day)}:${String(index)}:web-activity`),
					eventId,
					position: 0,
					kind: "FLAG",
					key: "web-activity",
					app: "web",
					subjectUnit: "USER",
					subjectId: userId,
					source: index < who.betaTesters.length ? "RULE" : "OVERRIDE_USER",
					revision: 1,
					ruleId: index < who.betaTesters.length ? ruleId("web-activity:everyone") : null,
					value: "on",
					experimentId: null,
					variant: null,
					occurredAt: at,
				},
				{
					id: id(`exposure:${String(day)}:${String(index)}:cta`),
					eventId,
					position: 1,
					kind: "CONFIG",
					key: "reward-claim-cta",
					app: index % 2 === 0 ? "web" : "mobile",
					subjectUnit: "USER",
					subjectId: userId,
					source: "EXPERIMENT",
					revision: 1,
					ruleId: null,
					value: index % 2 === 0 ? "standard" : "bold",
					experimentId: id("experiment:claim-emphasis"),
					variant: index % 2 === 0 ? "standard" : "bold",
					occurredAt: at,
				},
			);
		});
	}
	exposures.push({
		id: id("exposure:till:katil"),
		eventId: id("exposure-event:till"),
		position: 0,
		kind: "FLAG",
		key: "till-redemption",
		app: "api",
		subjectUnit: "LOCATION",
		subjectId: TENANT_SEED_IDS.mlkLocationKatil,
		source: "OVERRIDE_LOCATION",
		revision: null,
		ruleId: null,
		value: "off",
		experimentId: null,
		variant: null,
		occurredAt: BigInt(now - 3 * HOUR_MS),
	});
	for (const row of exposures) {
		await prisma.featureFlagExposure.upsert({ where: { id: row.id ?? "" }, update: {}, create: row });
	}
	const dayStart = Math.floor(now / DAY_MS) * DAY_MS;
	const daily: Prisma.FeatureFlagExposureDailyUncheckedCreateInput[] = [8, 9, 10].flatMap((daysBack) => [
		{
			id: id(`daily:${String(daysBack)}:showcase`),
			kind: "FLAG",
			key: "showcase",
			day: BigInt(dayStart - daysBack * DAY_MS),
			source: "RULE",
			ruleId: ruleId("showcase:outside-production"),
			value: "on",
			exposures: 40 + daysBack,
			subjects: 3,
		},
		{
			id: id(`daily:${String(daysBack)}:cta`),
			kind: "CONFIG",
			key: "reward-claim-cta",
			day: BigInt(dayStart - daysBack * DAY_MS),
			source: "DEFAULT",
			ruleId: null,
			value: "default",
			exposures: 120 + daysBack,
			subjects: 60,
		},
	]);
	for (const row of daily) {
		await prisma.featureFlagExposureDaily.upsert({ where: { id: row.id ?? "" }, update: {}, create: row });
	}
	// What the running experiment compares: claims, redemptions and sign-ins of the people it exposed.
	const metricKinds = ["reward-claims", "reward-redemptions", "sign-ins"];
	const metrics: Prisma.ExperimentMetricEventUncheckedCreateInput[] = users.flatMap((userId, index) =>
		metricKinds.flatMap((metric, metricIndex) =>
			Array.from({ length: (index % 3) + 1 }, (_unused, occurrence) => ({
				id: id(`metric:${userId}:${metric}:${String(occurrence)}`),
				eventId: id(`metric-event:${userId}:${metric}:${String(occurrence)}`),
				metric,
				userId,
				occurredAt: BigInt(now - (occurrence + metricIndex + 1) * HOUR_MS * 6),
			})),
		),
	);
	for (const row of metrics) {
		await prisma.experimentMetricEvent.upsert({ where: { id: row.id ?? "" }, update: {}, create: row });
	}
	return exposures.length + daily.length + metrics.length;
}

/** Seeds feature flags v2 and answers how many rows it wrote. */
export async function seedFeatureFlags(now: number): Promise<number> {
	const who = await people();
	let written = await seedGroups(now, who);
	for (const row of revisions(now, who)) {
		await prisma.flagRevision.upsert({ where: { id: row.id ?? "" }, update: {}, create: row });
		written += 1;
	}
	written += await seedOverridesAndKillSwitches(now, who);
	written += await seedExperiments(now, who);
	written += await seedExposures(now, who);
	await prisma.featureFlagCatalogVersion.upsert({ where: { scope: "catalog" }, update: {}, create: { id: id("catalog-version"), scope: "catalog", version: written } });
	return written + 1;
}
