// Side-effect-free seed ids (no Prisma client): importable by test fixtures and config docs.

/** Fixed seed UUIDs for canonical tenants (URL slugs are the merchant entry point). */
export const TENANT_SEED_IDS = Object.freeze({
	klTenant: "019b76da-a800-7a94-a198-23ad1b4cfdd9",
	mlkTenant: "019b76da-a800-72b9-80b8-91bd729eddbe",
	klLocation: "019b76da-a800-701a-abbd-a9a411b6958b",
	mlkLocationKatil: "019b76da-a800-7123-957b-191cb8255776",
	mlkLocationBeruang: "019b76da-a800-7685-9734-84f5f07eb21f",
	klOwnerMembership: "019b76da-a800-7b1d-b660-30bdb341a50c",
	mlkOwnerMembership: "019b76da-a800-7d4c-924e-c4e9e246a509",
	klCashierMembership: "019b76da-a800-71a1-8d20-165f781a00ae",
	mlkCashierMembership: "019b76da-a800-7b0f-b2e9-e7ccd28b72af",
	pendingNyonyaInvitation: "019b76da-a800-78eb-ab20-355793eb077b",
	pendingKlTeamInvitation: "019b76da-a800-7926-8bff-ff84232b77f0",
});

/**
 * The tenant a single-tenant deployment serves after `pnpm db:seed`
 * (Brew & Bean KL). `DEFAULT_TENANT_ID` in .env.example and the test
 * fixtures name this id; the API verifies at boot that it is a live row.
 */
export const SINGLE_TENANT_SEED_TENANT_ID: string = TENANT_SEED_IDS.klTenant;
