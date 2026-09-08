import { ConflictException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EmailVerificationService } from "../../auth/services/email-verification.service";
import type { CryptoService } from "../../auth/services/crypto.service";
import type { UserProvisioningService } from "../../auth/services/user-provisioning.service";
import type { MerchantMemberRepository } from "../repositories/merchant-member.repository";
import type { RewardAuditLogRepository } from "../repositories/reward-audit-log.repository";
import type { RewardUserRepository } from "../repositories/reward-user.repository";
import type { MerchantContextService } from "./merchant-context.service";

import { MerchantMemberService } from "./merchant-member.service";

describe("MerchantMemberService", () => {
	let service: MerchantMemberService;
	let rewardUserRepository: {
		findActiveByEmail: ReturnType<typeof vi.fn>;
		updateCredentials: ReturnType<typeof vi.fn>;
	};
	let merchantMemberRepository: {
		findActiveMembership: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
	};
	let auditLogRepository: { create: ReturnType<typeof vi.fn> };
	let cryptoService: { hash: ReturnType<typeof vi.fn> };
	let userProvisioning: {
		createConsumerAccount: ReturnType<typeof vi.fn>;
		ensureDefaultConsumerRole: ReturnType<typeof vi.fn>;
	};
	let merchantContext: {
		resolveOrgIdForUser: ReturnType<typeof vi.fn>;
		requireOwnerRole: ReturnType<typeof vi.fn>;
	};
	let emailVerificationService: { sendVerificationEmailIfUnverified: ReturnType<typeof vi.fn> };

	const orgId = "org-1";
	const actorUserId = "owner-1";

	beforeEach(() => {
		rewardUserRepository = {
			findActiveByEmail: vi.fn(),
			updateCredentials: vi.fn(),
		};
		merchantMemberRepository = {
			findActiveMembership: vi.fn().mockResolvedValue(null),
			create: vi.fn().mockResolvedValue(undefined),
		};
		auditLogRepository = { create: vi.fn().mockResolvedValue(undefined) };
		cryptoService = { hash: vi.fn().mockResolvedValue("hashed-password") };
		userProvisioning = {
			createConsumerAccount: vi.fn().mockResolvedValue({
				id: "new-user",
				email: "cashier@example.com",
				fullName: "New Cashier",
			}),
			ensureDefaultConsumerRole: vi.fn().mockResolvedValue(undefined),
		};
		merchantContext = {
			resolveOrgIdForUser: vi.fn().mockResolvedValue(orgId),
			requireOwnerRole: vi.fn().mockResolvedValue(undefined),
		};
		emailVerificationService = { sendVerificationEmailIfUnverified: vi.fn().mockResolvedValue(undefined) };

		service = new MerchantMemberService(
			rewardUserRepository as unknown as RewardUserRepository,
			merchantMemberRepository as unknown as MerchantMemberRepository,
			auditLogRepository as unknown as RewardAuditLogRepository,
			cryptoService as unknown as CryptoService,
			userProvisioning as unknown as UserProvisioningService,
			merchantContext as unknown as MerchantContextService,
			emailVerificationService as unknown as EmailVerificationService,
		);
	});

	it("creates a new consumer account when the email is unused", async () => {
		rewardUserRepository.findActiveByEmail.mockResolvedValue(null);

		const result = await service.createMember(actorUserId, orgId, {
			email: "cashier@example.com",
			password: "Cashier@123",
			fullName: "New Cashier",
			role: "CASHIER",
		});

		expect(userProvisioning.createConsumerAccount).toHaveBeenCalledTimes(1);
		expect(rewardUserRepository.updateCredentials).not.toHaveBeenCalled();
		expect(merchantMemberRepository.create).toHaveBeenCalledWith({
			userId: "new-user",
			merchantOrgId: orgId,
			role: "CASHIER",
		});
		expect(result).toEqual({
			userId: "new-user",
			email: "cashier@example.com",
			fullName: "New Cashier",
			merchantOrgId: orgId,
			role: "CASHIER",
		});
	});

	it("does not mutate credentials when the email already belongs to an existing user", async () => {
		rewardUserRepository.findActiveByEmail.mockResolvedValue({
			id: "existing-user",
			email: "victim@example.com",
			fullName: "Victim User",
		});

		const result = await service.createMember(actorUserId, orgId, {
			email: "victim@example.com",
			password: "Attacker@123",
			fullName: "Attacker Name",
			role: "CASHIER",
		});

		expect(cryptoService.hash).not.toHaveBeenCalled();
		expect(rewardUserRepository.updateCredentials).not.toHaveBeenCalled();
		expect(userProvisioning.ensureDefaultConsumerRole).toHaveBeenCalledWith("existing-user", actorUserId);
		expect(result.fullName).toBe("Victim User");
		expect(result.email).toBe("victim@example.com");
	});

	it("returns the existing membership when the user already has the same role", async () => {
		rewardUserRepository.findActiveByEmail.mockResolvedValue({
			id: "existing-user",
			email: "staff@example.com",
			fullName: "Staff User",
		});
		merchantMemberRepository.findActiveMembership.mockResolvedValue({
			role: "CASHIER",
		});

		const result = await service.createMember(actorUserId, orgId, {
			email: "staff@example.com",
			password: "ignored",
			fullName: "Ignored",
			role: "CASHIER",
		});

		expect(merchantMemberRepository.create).not.toHaveBeenCalled();
		expect(result.role).toBe("CASHIER");
	});

	it("throws when the user already belongs to the org with a different role", async () => {
		rewardUserRepository.findActiveByEmail.mockResolvedValue({
			id: "existing-user",
			email: "staff@example.com",
			fullName: "Staff User",
		});
		merchantMemberRepository.findActiveMembership.mockResolvedValue({
			role: "OWNER",
		});

		await expect(
			service.createMember(actorUserId, orgId, {
				email: "staff@example.com",
				password: "ignored",
				fullName: "Ignored",
				role: "CASHIER",
			}),
		).rejects.toBeInstanceOf(ConflictException);
	});
});
