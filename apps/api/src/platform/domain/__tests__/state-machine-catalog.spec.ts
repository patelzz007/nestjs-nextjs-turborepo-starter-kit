// Keeps docs/architecture/state-machines.md honest, and keeps new state machines from hiding:
// every Prisma enum named *Status / *State / *Stage is either modelled by a declared machine or
// listed below with where its transitions live today, and the doc draws every machine exactly as
// the code declares it.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { KYB_REVIEW, LOCATION_LIFECYCLE, SUPPORT_ACCESS_GRANT_LIFECYCLE, TENANT_LIFECYCLE } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { REWARD_LIFECYCLE } from "../../../contexts/rewards/domain/value-objects/reward-status.value-object";

const SCHEMA_TEXT: string = readFileSync(fileURLToPath(new URL("../../../../prisma/schema.prisma", import.meta.url)), "utf8");
const CATALOG_TEXT: string = readFileSync(fileURLToPath(new URL("../../../../../../docs/architecture/state-machines.md", import.meta.url)), "utf8");

/** `enum FooStatus { … }` blocks; the body is one value per line. */
const STATUS_ENUM_PATTERN = /^enum (?<name>\w+(?:Status|State|Stage)) \{(?<body>[^}]*)\}/gm;

/** What the catalog needs of a machine (any state and move types). */
interface CatalogedMachine {
	readonly name: string;
	readonly states: readonly string[];
	toMermaid(): string;
}

interface ModelledEnum {
	readonly machine: CatalogedMachine;
	/** Enum values the machine leaves out on purpose, and why. */
	readonly valuesLeftOut?: Readonly<Record<string, string>>;
}

/** Status enums with a declared machine. */
const MODELLED: Readonly<Record<string, ModelledEnum>> = {
	TenantLifecycleState: { machine: TENANT_LIFECYCLE },
	SupportAccessGrantStatus: { machine: SUPPORT_ACCESS_GRANT_LIFECYCLE },
	LocationStatus: { machine: LOCATION_LIFECYCLE },
	KybStatus: { machine: KYB_REVIEW },
	RewardStatus: {
		machine: REWARD_LIFECYCLE,
		valuesLeftOut: { EXPIRED: "decision #40: nothing sets it", DISABLED: "decision #40: nothing sets it" },
	},
};

/** Status enums without one yet — each listed, with its owner, in the catalog's tables. */
const NOT_MODELLED: readonly string[] = [
	"MfaRecoveryRequestStatus",
	"MembershipStatus",
	"TenantInvitationStatus",
	"TenantAccessRequestStatus",
	"TenantEncryptionKeyStatus",
	"TenantAppealStatus",
	"KybDocumentScanStatus",
	"FileStatus",
	"RewardClaimStatus",
	"RewardClaimHoldStatus",
	"RewardReferralStatus",
	"KanbanPlanningStage",
	"KanbanWorkState",
	"EmailLogStatus",
	"GithubAccountLinkStatus",
	"DocsSyncRunStatus",
	"OutboxEventStatus",
	"IdempotencyRecordStatus",
	"OpsBackupStatus",
	"LoadTestStatus",
	"NotificationDeliveryStatus",
	"BroadcastStatus",
	"BroadcastReportStatus",
	"PaymentStatus",
	"AccountErasureStatus",
	"StatusIncidentState",
	"WebhookEndpointStatus",
	"WebhookDeliveryStatus",
];

/** Every status enum of the schema, with its values. */
function statusEnums(): ReadonlyMap<string, readonly string[]> {
	const enums = new Map<string, readonly string[]>();
	for (const match of SCHEMA_TEXT.matchAll(STATUS_ENUM_PATTERN)) {
		const values = (match.groups?.body ?? "")
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0 && !line.startsWith("//"));
		enums.set(match.groups?.name ?? "", values);
	}
	return enums;
}

describe("state machine catalog", () => {
	const enums = statusEnums();

	it("finds the schema's status enums", () => {
		expect(enums.size).toBeGreaterThan(Object.keys(MODELLED).length);
	});

	it("decides every status enum: a declared machine, or an entry in the not-yet-modelled list", () => {
		const decided = new Set<string>([...Object.keys(MODELLED), ...NOT_MODELLED]);
		expect([...enums.keys()].filter((name) => !decided.has(name))).toEqual([]);
		expect([...decided].filter((name) => !enums.has(name))).toEqual([]);
		expect(NOT_MODELLED.filter((name) => Object.hasOwn(MODELLED, name))).toEqual([]);
	});

	it("models every value of a modelled enum, except the ones left out on purpose", () => {
		for (const [name, { machine, valuesLeftOut = {} }] of Object.entries(MODELLED)) {
			const expected = (enums.get(name) ?? []).filter((value) => !Object.hasOwn(valuesLeftOut, value));
			expect({ name, states: [...machine.states].sort() }).toEqual({ name, states: [...expected].sort() });
		}
	});

	it("draws every declared machine in the catalog exactly as the code declares it", () => {
		for (const { machine } of Object.values(MODELLED)) {
			expect({ machine: machine.name, drawn: CATALOG_TEXT.includes(`\`\`\`mermaid\n${machine.toMermaid()}\n\`\`\``) }).toEqual({ machine: machine.name, drawn: true });
		}
	});

	it("lists every enum without a machine in the catalog", () => {
		expect(NOT_MODELLED.filter((name) => !CATALOG_TEXT.includes(`\`${name}\``))).toEqual([]);
	});
});
