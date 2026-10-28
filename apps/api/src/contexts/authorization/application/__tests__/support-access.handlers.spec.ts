import { beforeEach, describe, expect, it } from "vitest";

import {
	AccessDeniedError,
	SupportAccessApproverNotOwnerError,
	SupportAccessGrantNotFoundError,
	SupportAccessGrantNotPendingError,
	SupportAccessGrantNotRevocableError,
	SupportAccessTenantNotFoundError,
} from "../../domain/errors/authorization.errors";
import { ApproveSupportAccessCommand } from "../commands/approve-support-access/approve-support-access.command";
import { ApproveSupportAccessHandler } from "../commands/approve-support-access/approve-support-access.handler";
import { ExpireSupportAccessGrantsCommand } from "../commands/expire-support-access-grants/expire-support-access-grants.command";
import { ExpireSupportAccessGrantsHandler } from "../commands/expire-support-access-grants/expire-support-access-grants.handler";
import { SUPPORT_ACCESS_EXPIRY_OPERATION } from "../ports/authorization.tokens";
import { authorizationSystemActor } from "../services/rbac-actor";
import { RequestSupportAccessCommand } from "../commands/request-support-access/request-support-access.command";
import { RequestSupportAccessHandler } from "../commands/request-support-access/request-support-access.handler";
import { RevokeSupportAccessCommand } from "../commands/revoke-support-access/revoke-support-access.command";
import { RevokeSupportAccessHandler } from "../commands/revoke-support-access/revoke-support-access.handler";
import { SUPPORT_ACCESS_AUDIT_ACTIONS } from "../services/support-access-audit";
import { SupportAccessGrantLocator } from "../services/support-access-grant-locator";
import { InMemoryAuthorizationStore, NOW, adminActor, anonymousActor } from "./fakes/authorization.fakes";

const ORG = "11111111-1111-4111-8111-111111111111";
const SUPPORT = "support-1";
const OWNER = "owner-1";
const MINUTE_MS = 60_000;

let store: InMemoryAuthorizationStore;

beforeEach(() => {
	store = new InMemoryAuthorizationStore();
	store.tenants.addTenant(ORG, [OWNER]);
});

async function request(tenantId: string = ORG): Promise<string> {
	const grant = await new RequestSupportAccessHandler(store.uow, store.clock).execute(
		new RequestSupportAccessCommand(adminActor(SUPPORT, { isSuperAdmin: true }), {
			tenantId,
			reason: "investigating ticket",
			ticketRef: "SUP-1",
			mode: "READ_ONLY",
			durationMinutes: 30,
		}),
	);
	return grant.id;
}

function approve(userId: string, grantId: string): Promise<void> {
	return new ApproveSupportAccessHandler(store.uow, new SupportAccessGrantLocator(store.uow), store.clock).execute(
		new ApproveSupportAccessCommand(adminActor(userId), grantId),
	);
}

function revoke(grantId: string): Promise<void> {
	return new RevokeSupportAccessHandler(store.uow, new SupportAccessGrantLocator(store.uow), store.clock).execute(
		new RevokeSupportAccessCommand(adminActor(SUPPORT, { isSuperAdmin: true }), grantId),
	);
}

describe("Support access", () => {
	it("requests a time-boxed grant awaiting the tenant, audited under the active policy version", async () => {
		const grantId = await request();

		expect(store.supportGrants.rows.get(grantId)).toMatchObject({ status: "PENDING_TENANT_APPROVAL", supportUserId: SUPPORT, expiresAt: NOW + 30 * MINUTE_MS });
		expect(store.tenants.audits).toEqual([expect.objectContaining({ action: SUPPORT_ACCESS_AUDIT_ACTIONS.requested, resourceId: grantId, actorUserId: SUPPORT })]);
	});

	it("refuses a grant for a tenant that does not exist, and an actor who is not signed in", async () => {
		await expect(request("22222222-2222-4222-8222-222222222222")).rejects.toBeInstanceOf(SupportAccessTenantNotFoundError);
		await expect(
			new RequestSupportAccessHandler(store.uow, store.clock).execute(
				new RequestSupportAccessCommand(anonymousActor(), { tenantId: ORG, reason: "investigating ticket", mode: "READ_ONLY", durationMinutes: 30 }),
			),
		).rejects.toBeInstanceOf(AccessDeniedError);
		expect(store.supportGrants.rows.size).toBe(0);
	});

	it("is approved once by an active owner of the tenant, with an Allow audit row", async () => {
		const grantId = await request();

		await expect(approve("stranger-1", grantId)).rejects.toBeInstanceOf(SupportAccessApproverNotOwnerError);
		await approve(OWNER, grantId);

		expect(store.supportGrants.rows.get(grantId)).toMatchObject({ status: "ACTIVE", tenantApprovedById: OWNER });
		expect(store.tenants.audits.at(-1)).toMatchObject({ action: SUPPORT_ACCESS_AUDIT_ACTIONS.approved, decision: "Allow" });
		await expect(approve(OWNER, grantId)).rejects.toBeInstanceOf(SupportAccessGrantNotPendingError);
	});

	it("cannot be approved once it expired", async () => {
		const grantId = await request();
		store.clock.advance(30 * MINUTE_MS);

		await expect(approve(OWNER, grantId)).rejects.toBeInstanceOf(SupportAccessGrantNotPendingError);
	});

	it("is revoked once, then refuses a second revocation", async () => {
		const grantId = await request();

		await revoke(grantId);

		expect(store.supportGrants.rows.get(grantId)).toMatchObject({ status: "REVOKED", revokedAt: NOW });
		await expect(revoke(grantId)).rejects.toBeInstanceOf(SupportAccessGrantNotRevocableError);
		expect(store.tenants.audits.map((audit) => audit.action)).toEqual([SUPPORT_ACCESS_AUDIT_ACTIONS.requested, SUPPORT_ACCESS_AUDIT_ACTIONS.revoked]);
	});

	it("answers not found for an unknown grant", async () => {
		await expect(revoke("ghost")).rejects.toBeInstanceOf(SupportAccessGrantNotFoundError);
	});

	describe("expiry job", () => {
		function expire(): ReturnType<ExpireSupportAccessGrantsHandler["execute"]> {
			return new ExpireSupportAccessGrantsHandler(store.uow, store.clock).execute(
				new ExpireSupportAccessGrantsCommand(authorizationSystemActor(SUPPORT_ACCESS_EXPIRY_OPERATION, "cron", "expire grants")),
			);
		}

		it("marks pending and active grants past their expiry EXPIRED, and nothing else", async () => {
			const pending = await request();
			const active = await request();
			await approve(OWNER, active);
			const revoked = await request();
			await revoke(revoked);
			store.clock.advance(30 * MINUTE_MS);

			const result = await expire();
			expect(result.expired).toBe(2);
			expect([...result.grantIds].sort()).toEqual([pending, active].sort());

			expect(store.supportGrants.rows.get(pending)?.status).toBe("EXPIRED");
			expect(store.supportGrants.rows.get(active)?.status).toBe("EXPIRED");
			expect(store.supportGrants.rows.get(revoked)?.status).toBe("REVOKED");
			await expect(revoke(active)).rejects.toBeInstanceOf(SupportAccessGrantNotRevocableError);
		});

		it("leaves a grant whose time has not run out, and is idempotent", async () => {
			const grantId = await request();

			await expect(expire()).resolves.toEqual({ expired: 0, grantIds: [] });
			store.clock.advance(30 * MINUTE_MS);
			await expire();
			await expect(expire()).resolves.toEqual({ expired: 0, grantIds: [] });
			expect(store.supportGrants.rows.get(grantId)?.status).toBe("EXPIRED");
		});
	});
});
