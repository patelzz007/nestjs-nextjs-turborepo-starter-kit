import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	API_VERSION_PREFIX,
	ApiErrorResponseSchema,
	OrganizationContextResponseSchema,
	OrganizationMemberInviteListResponseSchema,
	OrganizationMemberRosterListResponseSchema,
} from "@workspace/shared";

import { ORGANIZATION_SEED_SLUGS } from "../prisma/seed/organizations";
import { createE2eApp, login, type InjectResponse, type LoginResult, mutationHeaders, parseSuccessEnvelope } from "./e2e-helpers";

/**
 * Organization management (team, store locations, business verification) is
 * authorized by `merchant:*` capabilities — the same role table the merchant
 * app uses to hide its sidebar items — not by hard-coded role lists. Seeded KL
 * organization: OWNER `brew.owner@…`, CASHIER `brew.cashier@…`.
 */
describe("Merchant organization-management capabilities (e2e)", () => {
	let app: NestFastifyApplication;
	let owner: LoginResult;
	let cashier: LoginResult;

	beforeAll(async () => {
		app = await createE2eApp();
		owner = await login(app, "brew.owner@kl-rewards.demo", "BrewOwner@123", "merchant");
		cashier = await login(app, "brew.cashier@kl-rewards.demo", "BrewCashier@123", "merchant");
	});

	afterAll(async () => {
		await app.close();
	});

	function merchantHeaders(session: LoginResult): Record<string, string> {
		return { cookie: `merchantAccessToken=${session.accessToken}; merchantRefreshToken=${session.refreshToken}`, "x-client-type": "merchant" };
	}

	function errorCodeOf(response: InjectResponse): string {
		return ApiErrorResponseSchema.parse(response.json()).error.code;
	}

	const orgPath = (path: string): string => `${API_VERSION_PREFIX}/orgs/${ORGANIZATION_SEED_SLUGS.kl}${path}`;

	it("lets the owner list pending team invitations (merchant:manage_team)", async () => {
		const response = await app.inject({ method: "GET", url: orgPath("/members/invites"), headers: merchantHeaders(owner) });

		expect(response.statusCode).toBe(200);
		expect(parseSuccessEnvelope(response, OrganizationMemberInviteListResponseSchema).success).toBe(true);
	});

	it("lets the owner list the team roster with every member's name and email (users RLS is self-only, so the profiles come from an allowlisted system read)", async () => {
		const response = await app.inject({ method: "GET", url: orgPath("/members"), headers: merchantHeaders(owner) });

		expect(response.statusCode, response.body).toBe(200);
		const roster = parseSuccessEnvelope(response, OrganizationMemberRosterListResponseSchema).data;
		const emails: readonly string[] = roster.map((member) => member.email);
		expect(emails).toContain("brew.owner@kl-rewards.demo");
		// A co-member — the row the old tenant-scoped join could not see.
		expect(emails).toContain("brew.cashier@kl-rewards.demo");
		expect(roster.every((member) => member.fullName.length > 0)).toBe(true);
	});

	it("lets the owner read business verification (merchant:manage_verification)", async () => {
		const response = await app.inject({ method: "GET", url: orgPath("/kyb"), headers: merchantHeaders(owner) });

		expect(response.statusCode).toBe(200);
	});

	it.each([
		["GET", "/members"],
		["GET", "/members/invites"],
		["GET", "/kyb"],
	] satisfies ["GET", string][])("denies a cashier %s %s with the role-capability error", async (method, path) => {
		const response = await app.inject({ method, url: orgPath(path), headers: merchantHeaders(cashier) });

		expect(response.statusCode).toBe(403);
		expect(errorCodeOf(response)).toBe("ORGANIZATION_ROLE_CAPABILITY_REQUIRED");
	});

	it("denies a cashier requesting a new store (merchant:manage_locations)", async () => {
		const response = await app.inject({
			method: "POST",
			url: orgPath("/locations"),
			headers: mutationHeaders(merchantHeaders(cashier)),
			payload: { name: "Cashier store attempt", addressText: "1 Jalan Ujian, Kuala Lumpur" },
		});

		expect(response.statusCode).toBe(403);
		expect(errorCodeOf(response)).toBe("ORGANIZATION_ROLE_CAPABILITY_REQUIRED");
	});

	it("still lets a cashier read the store locations (merchant:view_locations comes from the member-wide context)", async () => {
		const response = await app.inject({ method: "GET", url: orgPath("/context"), headers: merchantHeaders(cashier) });

		expect(response.statusCode).toBe(200);
		expect(parseSuccessEnvelope(response, OrganizationContextResponseSchema).data.locations.length).toBeGreaterThan(0);
	});
});
