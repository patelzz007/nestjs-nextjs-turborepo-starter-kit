import type { SchemaJson } from "@cedar-policy/cedar-wasm/nodejs";

import { MERCHANT_CAPABILITY_CEDAR_ACTIONS } from "../../organization/constants/merchant-capability-cedar-actions";

/**
 * THE Cedar model of RewardHub authorization: namespace, entity types, the
 * attributes policies may read, and every action. The Cedar schema below is
 * generated from these constants, so policy validation (draft time), request
 * validation (runtime) and simulation all use one definition.
 *
 * Adding a merchant capability with a Cedar action (`MERCHANT_CAPABILITY_CEDAR_ACTIONS`)
 * adds it to the schema automatically.
 */
export const CEDAR_NAMESPACE = "RewardHub";

/** Entity type names (unqualified) and their fully qualified Cedar names. */
export const CEDAR_ENTITY_TYPES = {
	/** An organization member acting on the organization (the principal). */
	member: "Member",
	/** The organization a decision is about (the resource). */
	organization: "Organization",
	action: "Action",
} satisfies Record<string, string>;

export function qualifiedCedarType(entityType: string): string {
	return `${CEDAR_NAMESPACE}::${entityType}`;
}

/**
 * Platform guardrail actions: evaluated by guardrail policies, not mapped to
 * a merchant capability. Policies reference them as `RewardHub::Action::"<id>"`.
 */
export const CEDAR_GUARDRAIL_ACTIONS = {
	assignPolicyAdmin: "assignPolicyAdmin",
	removeLastOwner: "removeLastOwner",
	transferOwnership: "transferOwnership",
} satisfies Record<string, string>;

/** The capability actions the runtime evaluates (deduplicated). */
export const CEDAR_CAPABILITY_ACTIONS: readonly string[] = [
	...new Set(Object.values(MERCHANT_CAPABILITY_CEDAR_ACTIONS).flatMap((action: string | null): string[] => (action === null ? [] : [action]))),
];

/** Every action declared in the schema. */
export const CEDAR_ACTIONS: readonly string[] = [...CEDAR_CAPABILITY_ACTIONS, ...Object.values(CEDAR_GUARDRAIL_ACTIONS)];

/** `RewardHub::Action::"<id>"` — the action literal a policy writes. */
export function cedarActionLiteral(action: string): string {
	return `${qualifiedCedarType(CEDAR_ENTITY_TYPES.action)}::${JSON.stringify(action)}`;
}

/** Name the preparsed schema is cached under inside the Cedar engine. */
export const CEDAR_SCHEMA_NAME = "rewardhub";

/**
 * The Cedar schema (JSON form).
 * - `Member`: `role` (membership role), `locationScope` (`ALL_LOCATIONS` | `SELECTED`),
 *   `locationIds` (stores a SELECTED member reaches).
 * - `Organization`: `organizationId`, optional `locationId` (the store a request is about).
 */
export const REWARDHUB_CEDAR_SCHEMA: SchemaJson<string> = {
	[CEDAR_NAMESPACE]: {
		entityTypes: {
			[CEDAR_ENTITY_TYPES.member]: {
				shape: {
					type: "Record",
					attributes: {
						role: { type: "String" },
						locationScope: { type: "String" },
						locationIds: { type: "Set", element: { type: "String" } },
					},
				},
			},
			[CEDAR_ENTITY_TYPES.organization]: {
				shape: {
					type: "Record",
					attributes: {
						organizationId: { type: "String" },
						locationId: { type: "String", required: false },
					},
				},
			},
		},
		actions: Object.fromEntries(
			CEDAR_ACTIONS.map((action: string) => [action, { appliesTo: { principalTypes: [CEDAR_ENTITY_TYPES.member], resourceTypes: [CEDAR_ENTITY_TYPES.organization] } }]),
		),
	},
};
