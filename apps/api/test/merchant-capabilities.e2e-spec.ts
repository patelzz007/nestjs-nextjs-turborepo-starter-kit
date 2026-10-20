import { type NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	API_VERSION_PREFIX,
	ApiErrorResponseSchema,
	TenantContextResponseSchema,
	TenantRewardMembershipResponseSchema,
	TenantMemberInviteResponseSchema,
	TenantMemberRosterResponseSchema,
} from "@workspace/shared";

import { TENANT_SEED_SLUGS } from "../prisma/seed/tenants";
import { z } from "zod";

import { createE2eApp, login, mutationHeaders, parsePaginatedEnvelope, parseSuccessEnvelope, type InjectResponse, type LoginResult } from "./e2e-helpers";

/**
 * Tenant management (team, store locations, business verification) is
 * authorized by `merchant:*` capabilities — the same role table the merchant
 * app uses to hide its sidebar items — not by hard-coded role lists. Seeded KL
 * tenant: OWNER `brew.owner@…`, CASHIER `brew.cashier@…`.
 */
describe("Merchant tenant-management capabilities (e2e)", () => {
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

	const orgPath = (path: string): string => `${API_VERSION_PREFIX}/tenants/${TENANT_SEED_SLUGS.kl}${path}`;

	it("lets the owner list pending team invitations (merchant:manage_team)", async () => {
		const response = await app.inject({ method: "GET", url: orgPath("/members/invites"), headers: merchantHeaders(owner) });

		expect(response.statusCode).toBe(200);
		expect(parseSuccessEnvelope(response, z.array(TenantMemberInviteResponseSchema)).success).toBe(true);
	});

	it("lets the owner list the team roster with every member's name and email (users RLS is self-only, so the profiles come from an allowlisted system read)", async () => {
		const response = await app.inject({ method: "GET", url: orgPath("/members"), headers: merchantHeaders(owner) });

		expect(response.statusCode, response.body).toBe(200);
		const roster = parseSuccessEnvelope(response, z.array(TenantMemberRosterResponseSchema)).data;
		const emails: readonly string[] = roster.map((member) => member.email);
		expect(emails).toContain("brew.owner@kl-rewards.demo");
		// A co-member — the row the old tenant-scoped join could not see.
		expect(emails).toContain("brew.cashier@kl-rewards.demo");
		expect(roster.every((member) => member.fullName.length > 0)).toBe(true);
	});

	it("pages the roster in join order, with the totals in meta, and narrows it by role", async () => {
		const first = await app.inject({ method: "GET", url: orgPath("/members?limit=1"), headers: merchantHeaders(owner) });
		expect(first.statusCode, first.body).toBe(200);
		const firstPage = parsePaginatedEnvelope(first, TenantMemberRosterResponseSchema);
		const { meta } = firstPage;
		expect(firstPage.data).toHaveLength(1);
		expect(meta).toMatchObject({ limit: 1, page: 1, hasNext: true, hasPrevious: false });
		expect(meta.total).toBeGreaterThanOrEqual(2);

		const next = await app.inject({ method: "GET", url: orgPath(`/members?limit=1&cursor=${encodeURIComponent(meta.nextCursor ?? "")}`), headers: merchantHeaders(owner) });
		const nextPage = parseSuccessEnvelope(next, z.array(TenantMemberRosterResponseSchema)).data;
		expect(nextPage.map((member) => member.id)).not.toEqual(firstPage.data.map((member) => member.id));

		const owners = await app.inject({ method: "GET", url: orgPath("/members?filter[role]=OWNER"), headers: merchantHeaders(owner) });
		expect(parseSuccessEnvelope(owners, z.array(TenantMemberRosterResponseSchema)).data.every((member) => member.role === "OWNER")).toBe(true);
	});

	it("pages the owner's own memberships and finds one by the tenant's name", async () => {
		const page = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/tenants/memberships?limit=1`, headers: merchantHeaders(owner) });
		expect(page.statusCode, page.body).toBe(200);
		const { data, meta } = parsePaginatedEnvelope(page, TenantRewardMembershipResponseSchema);
		expect(data).toHaveLength(1);
		expect(meta.total).toBeGreaterThanOrEqual(1);

		const found = await app.inject({ method: "GET", url: `${API_VERSION_PREFIX}/tenants/memberships?search=${TENANT_SEED_SLUGS.kl}`, headers: merchantHeaders(owner) });
		expect(parseSuccessEnvelope(found, z.array(TenantRewardMembershipResponseSchema)).data.map((membership) => membership.tenantSlug)).toEqual([TENANT_SEED_SLUGS.kl]);
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
		expect(errorCodeOf(response)).toBe("TENANT_ROLE_CAPABILITY_REQUIRED");
	});

	it("denies a cashier requesting a new store (merchant:manage_locations)", async () => {
		const response = await app.inject({
			method: "POST",
			url: orgPath("/locations"),
			headers: mutationHeaders(merchantHeaders(cashier)),
			payload: { name: "Cashier store attempt", addressText: "1 Jalan Ujian, Kuala Lumpur" },
		});

		expect(response.statusCode).toBe(403);
		expect(errorCodeOf(response)).toBe("TENANT_ROLE_CAPABILITY_REQUIRED");
	});

	it("still lets a cashier read the store locations (merchant:view_locations comes from the member-wide context)", async () => {
		const response = await app.inject({ method: "GET", url: orgPath("/context"), headers: merchantHeaders(cashier) });

		expect(response.statusCode).toBe(200);
		expect(parseSuccessEnvelope(response, TenantContextResponseSchema).data.locations.length).toBeGreaterThan(0);
	});
});
