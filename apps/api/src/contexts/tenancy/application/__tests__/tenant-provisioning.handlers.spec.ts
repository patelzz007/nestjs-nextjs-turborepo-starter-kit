import { epochMs } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { Clock } from "../../../../platform/application/clock.port";
import type { TenantProvisioningGate } from "../../../../platform/application/tenancy/tenant-provisioning.port";
import type { UnitOfWork } from "../../../../platform/application/unit-of-work.port";
import { TenantProvisioningDisabledError } from "../../domain/errors/tenants.errors";
import { ProvisionMerchantFromAdminInviteCommand } from "../commands/provision-merchant-from-admin-invite/provision-merchant-from-admin-invite.command";
import { ProvisionMerchantFromAdminInviteHandler } from "../commands/provision-merchant-from-admin-invite/provision-merchant-from-admin-invite.handler";
import { ProvisionTenantFromPlatformInviteCommand } from "../commands/provision-tenant-from-platform-invite/provision-tenant-from-platform-invite.command";
import { ProvisionTenantFromPlatformInviteHandler } from "../commands/provision-tenant-from-platform-invite/provision-tenant-from-platform-invite.handler";
import { GetMerchantInviteAvailabilityHandler } from "../queries/get-merchant-invite-availability/get-merchant-invite-availability.handler";
import type { InviteTokenPort } from "../ports/invite-tokens.port";
import type { TenantsScope } from "../tenants-scope";

const ACTOR: ActorContext = {
	kind: "user",
	userId: "0199a1b2-0000-7000-8000-000000000009",
	sessionId: "session-1",
	tenantId: null,
	isSuperAdmin: true,
	accessScope: "tenant",
	impersonatorUserId: null,
	request: { requestId: "req-1", ip: null, userAgent: null, deviceLabel: null, endpoint: null },
};

/** A single-tenant deployment: no tenant may be created. */
const SINGLE_TENANT: TenantProvisioningGate = { isProvisioningAllowed: (): boolean => false };
const MULTI_TENANT: TenantProvisioningGate = { isProvisioningAllowed: (): boolean => true };

/** Records whether any work reached the database or a token was minted; a refusal must leave both untouched. */
class Untouched implements UnitOfWork<TenantsScope>, InviteTokenPort {
	public opened = 0;
	public issued = 0;

	public run<TResult>(): Promise<TResult> {
		this.opened += 1;
		return Promise.reject(new Error("no transaction expected"));
	}

	public runSystemOperation<TResult>(): Promise<TResult> {
		this.opened += 1;
		return Promise.reject(new Error("no transaction expected"));
	}

	public issue(): { readonly rawToken: string; readonly tokenHash: string } {
		this.issued += 1;
		return { rawToken: "raw", tokenHash: "hash" };
	}

	public hash(rawToken: string): string {
		return rawToken;
	}
}

const CLOCK: Clock = { now: () => epochMs(1_792_368_000_000) };

describe("tenant provisioning on a single-tenant deployment", () => {
	it("refuses an admin merchant invite before any token or row exists (403 TENANT_PROVISIONING_DISABLED)", async () => {
		const io = new Untouched();
		const handler = new ProvisionMerchantFromAdminInviteHandler(io, io, CLOCK, SINGLE_TENANT);

		await expect(
			handler.execute(new ProvisionMerchantFromAdminInviteCommand(ACTOR, { email: "owner@kopi.example", businessName: "Kopi & Co", city: "KUALA_LUMPUR" })),
		).rejects.toBeInstanceOf(TenantProvisioningDisabledError);
		expect({ opened: io.opened, issued: io.issued }).toEqual({ opened: 0, issued: 0 });
	});

	it("refuses a platform tenant invite the same way", async () => {
		const io = new Untouched();
		const handler = new ProvisionTenantFromPlatformInviteHandler(io, io, CLOCK, SINGLE_TENANT);

		await expect(
			handler.execute(
				new ProvisionTenantFromPlatformInviteCommand(ACTOR, {
					email: "owner@kopi.example",
					displayName: "Kopi & Co",
					slug: "kopi-co",
					intendedRole: "OWNER",
					city: "KUALA_LUMPUR",
					category: "Cafe",
				}),
			),
		).rejects.toBeInstanceOf(TenantProvisioningDisabledError);
		expect({ opened: io.opened, issued: io.issued }).toEqual({ opened: 0, issued: 0 });
	});

	it("tells the admin panel invites are off, from the same gate", async () => {
		await expect(new GetMerchantInviteAvailabilityHandler(SINGLE_TENANT).execute()).resolves.toEqual({ available: false });
		await expect(new GetMerchantInviteAvailabilityHandler(MULTI_TENANT).execute()).resolves.toEqual({ available: true });
	});
});
