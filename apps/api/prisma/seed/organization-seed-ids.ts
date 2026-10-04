// Side-effect-free seed ids (no Prisma client): importable by test fixtures and config docs.

/** Fixed seed UUIDs for canonical organizations (URL slugs are the merchant entry point). */
export const ORGANIZATION_SEED_IDS = Object.freeze({
	klOrganization: "a178a4d1-6915-4eb3-bf84-6fb14e1feb6c",
	mlkOrganization: "b57401d5-536e-464f-9ae9-4756b6dd5f61",
	klLocation: "c178a4d1-6915-4eb3-bf84-6fb14e1feb6d",
	mlkLocationKatil: "d57401d5-536e-464f-9ae9-4756b6dd5f62",
	mlkLocationBeruang: "257401d5-536e-464f-9ae9-4756b6dd5f65",
	klOwnerMembership: "e178a4d1-6915-4eb3-bf84-6fb14e1feb6e",
	mlkOwnerMembership: "f57401d5-536e-464f-9ae9-4756b6dd5f63",
	klCashierMembership: "0178a4d1-6915-4eb3-bf84-6fb14e1feb6f",
	mlkCashierMembership: "157401d5-536e-464f-9ae9-4756b6dd5f64",
	pendingNyonyaInvitation: "2178a4d1-6915-4eb3-bf84-6fb14e1feb70",
	pendingKlTeamInvitation: "3178a4d1-6915-4eb3-bf84-6fb14e1feb71",
});

/**
 * The organization a single-tenant deployment serves after `pnpm db:seed`
 * (Brew & Bean KL). `DEFAULT_ORGANIZATION_ID` in .env.example and the test
 * fixtures name this id; the API verifies at boot that it is a live row.
 */
export const SINGLE_TENANT_SEED_ORGANIZATION_ID: string = ORGANIZATION_SEED_IDS.klOrganization;
