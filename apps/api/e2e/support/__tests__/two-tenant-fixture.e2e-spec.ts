import { beforeAll, describe, expect, it } from "vitest";

import { getApiConfig } from "../../../src/config/api-config";
import { TypedConfigService } from "../../../src/config/typed-config.service";
import { RequestContextService } from "../../../src/platform/infrastructure/context/request-context";
import { PrismaService } from "../../../src/prisma/prisma.service";
import { TenantTransactionService } from "../../../src/prisma/tenant-transaction.service";
import { SEED_TEST_FIXTURE_OPERATION } from "../../../src/prisma/seed-test-fixture.operation";
import { seedTwoTenantFixture, TWO_TENANT_FIXTURE } from "../two-tenant-fixture";

describe("two-tenant fixture", () => {
	const prisma = new PrismaService(new TypedConfigService(getApiConfig()));
	const transactions = new TenantTransactionService(prisma, new RequestContextService());

	beforeAll(async () => {
		await prisma.ensureConnected();
		await seedTwoTenantFixture(prisma);
		await seedTwoTenantFixture(prisma);
	});

	it("keeps every fixture column stable across a second seed", async () => {
		const ids = TWO_TENANT_FIXTURE;
		await transactions.withSystemOperation({ operation: SEED_TEST_FIXTURE_OPERATION, reason: "Read the two-tenant fixture back", actorUserId: null }, async (tx) => {
			const tenantA = await tx.tenant.findUniqueOrThrow({ where: { id: ids.tenantA } });
			const tenantS = await tx.tenant.findUniqueOrThrow({ where: { id: ids.tenantS } });
			const rewardA = await tx.reward.findUniqueOrThrow({ where: { id: ids.rewardA } });
			const scope = await tx.rewardLocationScope.findUniqueOrThrow({ where: { id: ids.rewardScopeA } });
			const customer = await tx.user.findUniqueOrThrow({ where: { id: ids.userCustomerC } });
			const platform = await tx.user.findUniqueOrThrow({ where: { id: ids.userPlatformP } });
			const memberships = await tx.membership.findMany({ where: { userId: ids.userCustomerC } });
			const suspended = await tx.membership.findUniqueOrThrow({ where: { id: ids.membershipASuspended } });
			const claim = await tx.rewardClaim.findUniqueOrThrow({ where: { id: ids.claimC } });
			const redemption = await tx.rewardRedemption.findUniqueOrThrow({ where: { id: ids.redemptionA } });
			const terminal = await tx.tenantTerminal.findUniqueOrThrow({ where: { id: ids.terminalA } });

			expect(tenantA).toMatchObject({ slug: "fixture-tenant-a", displayName: "Tenant A", lifecycleState: "ACTIVE", timeZone: "Asia/Kuala_Lumpur", isDeleted: false });
			expect(tenantS.lifecycleState).toBe("SUSPENDED");
			expect(rewardA).toMatchObject({ tenantId: ids.tenantA, title: "Reward A", locationScopeType: "SELECTED", status: "PUBLISHED" });
			expect(scope).toMatchObject({ tenantId: ids.tenantA, rewardId: ids.rewardA, locationId: ids.locationAKl });
			expect(customer.isSuperAdmin).toBe(false);
			expect(platform.isSuperAdmin).toBe(true);
			expect(memberships).toEqual([]);
			expect(suspended).toMatchObject({ tenantId: ids.tenantA, userId: ids.userASuspended, role: "CASHIER", status: "SUSPENDED", isDeleted: false });
			expect(claim).toMatchObject({ userId: ids.userCustomerC, rewardId: ids.rewardA, status: "PENDING" });
			expect(redemption).toMatchObject({ tenantId: ids.tenantA, locationId: ids.locationAKl, claimId: ids.claimARedeemed });
			expect(terminal).toMatchObject({ tenantId: ids.tenantA, locationId: ids.locationAKl, apiKeyId: ids.apiKeyA, terminalId: "FIXTURE-A-KL" });
		});
	});
});
