import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { PrismaService } from "../../../prisma/prisma.service";
import { DEFAULT_CONSUMER_ROLE_NAME } from "../../authorization/constants/authorization.constants";
import { RoleService } from "../../authorization/services/role.service";
import { SignupReferralRepository } from "../signup-referrals/signup-referral.repository";
import { UserProvisioningService } from "./user-provisioning.service";

vi.mock("../../../prisma/prisma.service", () => ({ PrismaService: class {} }));
vi.mock("../../authorization/services/role.service", () => ({ RoleService: class {} }));

const USER_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const ROLE_ID = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

describe("UserProvisioningService.createConsumerAccountInTx", () => {
	let service: UserProvisioningService;
	const roleService = { findByName: vi.fn(), assignToUserAtProvisioningInTx: vi.fn() };
	const signupReferralRepository = { insertCodeInTx: vi.fn() };
	const createUser = vi.fn();
	const tx = Object.assign(new PrismaService(createTestTypedConfig()), { user: { create: createUser } });

	beforeEach(async () => {
		vi.clearAllMocks();
		roleService.findByName.mockResolvedValue({ id: ROLE_ID, name: DEFAULT_CONSUMER_ROLE_NAME });
		roleService.assignToUserAtProvisioningInTx.mockResolvedValue({});
		createUser.mockResolvedValue({ id: USER_ID, email: "staff@example.com" });
		const moduleRef = await Test.createTestingModule({
			providers: [
				UserProvisioningService,
				{ provide: PrismaService, useValue: {} },
				{ provide: RoleService, useValue: roleService },
				{ provide: SignupReferralRepository, useValue: signupReferralRepository },
			],
		}).compile();
		service = moduleRef.get(UserProvisioningService);
	});

	it("creates the account and assigns the default role on the CALLER's transaction, with the account as the audited actor", async () => {
		await service.createConsumerAccountInTx(tx, { email: "staff@example.com", passwordHash: "hash", fullName: "Staff Member" });

		expect(createUser).toHaveBeenCalledWith({ data: { email: "staff@example.com", passwordHash: "hash", fullName: "Staff Member", emailVerifiedAt: null } });
		expect(roleService.findByName).toHaveBeenCalledWith(DEFAULT_CONSUMER_ROLE_NAME);
		expect(roleService.assignToUserAtProvisioningInTx).toHaveBeenCalledWith(USER_ID, ROLE_ID, USER_ID, tx);
		expect(signupReferralRepository.insertCodeInTx).toHaveBeenCalledWith(tx, USER_ID, expect.any(Number));
	});

	it("fails before creating anything when the default role is not configured", async () => {
		roleService.findByName.mockResolvedValue(null);

		await expect(service.createConsumerAccountInTx(tx, { email: "staff@example.com", passwordHash: "hash", fullName: "Staff Member" })).rejects.toThrow(
			DEFAULT_CONSUMER_ROLE_NAME,
		);
		expect(createUser).not.toHaveBeenCalled();
	});
});

describe("UserProvisioningService.createConsumerAccount", () => {
	let service: UserProvisioningService;
	const roleService = { assignDefaultConsumerRole: vi.fn() };
	const signupReferralRepository = { insertCodeInTx: vi.fn() };
	const createUser = vi.fn();
	const tx = Object.assign(new PrismaService(createTestTypedConfig()), { user: { create: createUser } });
	const prisma = { $transaction: vi.fn() };

	beforeEach(async () => {
		vi.clearAllMocks();
		createUser.mockResolvedValue({ id: USER_ID, email: "owner@example.com" });
		prisma.$transaction.mockImplementation(async (handler: (client: typeof tx) => Promise<object>) => handler(tx));
		const moduleRef = await Test.createTestingModule({
			providers: [
				UserProvisioningService,
				{ provide: PrismaService, useValue: prisma },
				{ provide: RoleService, useValue: roleService },
				{ provide: SignupReferralRepository, useValue: signupReferralRepository },
			],
		}).compile();
		service = moduleRef.get(UserProvisioningService);
	});

	it("creates the account and its first signup referral code in ONE transaction, then assigns the default role", async () => {
		await service.createConsumerAccount({ email: "owner@example.com", passwordHash: "hash", fullName: "Owner" });

		expect(prisma.$transaction).toHaveBeenCalledOnce();
		expect(createUser).toHaveBeenCalledWith({ data: { email: "owner@example.com", passwordHash: "hash", fullName: "Owner", emailVerifiedAt: null } });
		expect(signupReferralRepository.insertCodeInTx).toHaveBeenCalledWith(tx, USER_ID, expect.any(Number));
		expect(roleService.assignDefaultConsumerRole).toHaveBeenCalledWith(USER_ID);
	});

	it("leaves no account behind when the code cannot be issued", async () => {
		prisma.$transaction.mockRejectedValue(new Error("code allocation failed"));

		await expect(service.createConsumerAccount({ email: "owner@example.com", passwordHash: "hash", fullName: "Owner" })).rejects.toThrow("code allocation failed");
		expect(roleService.assignDefaultConsumerRole).not.toHaveBeenCalled();
	});
});
