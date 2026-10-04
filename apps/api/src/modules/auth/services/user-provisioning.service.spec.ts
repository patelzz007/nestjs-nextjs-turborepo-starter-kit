import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { PrismaService } from "../../../prisma/prisma.service";
import { DEFAULT_CONSUMER_ROLE_NAME } from "../../authorization/constants/authorization.constants";
import { RoleService } from "../../authorization/services/role.service";
import { UserProvisioningService } from "./user-provisioning.service";

vi.mock("../../../prisma/prisma.service", () => ({ PrismaService: class {} }));
vi.mock("../../authorization/services/role.service", () => ({ RoleService: class {} }));

const USER_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const ROLE_ID = "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";

describe("UserProvisioningService.createConsumerAccountInTx", () => {
	let service: UserProvisioningService;
	const roleService = { findByName: vi.fn(), assignToUserAtProvisioningInTx: vi.fn() };
	const createUser = vi.fn();
	const tx = Object.assign(new PrismaService(createTestTypedConfig()), { user: { create: createUser } });

	beforeEach(async () => {
		vi.clearAllMocks();
		roleService.findByName.mockResolvedValue({ id: ROLE_ID, name: DEFAULT_CONSUMER_ROLE_NAME });
		roleService.assignToUserAtProvisioningInTx.mockResolvedValue({});
		createUser.mockResolvedValue({ id: USER_ID, email: "staff@example.com" });
		const moduleRef = await Test.createTestingModule({
			providers: [UserProvisioningService, { provide: PrismaService, useValue: {} }, { provide: RoleService, useValue: roleService }],
		}).compile();
		service = moduleRef.get(UserProvisioningService);
	});

	it("creates the account and assigns the default role on the CALLER's transaction, with the account as the audited actor", async () => {
		await service.createConsumerAccountInTx(tx, { email: "staff@example.com", passwordHash: "hash", fullName: "Staff Member" });

		expect(createUser).toHaveBeenCalledWith({ data: { email: "staff@example.com", passwordHash: "hash", fullName: "Staff Member", emailVerifiedAt: null } });
		expect(roleService.findByName).toHaveBeenCalledWith(DEFAULT_CONSUMER_ROLE_NAME);
		expect(roleService.assignToUserAtProvisioningInTx).toHaveBeenCalledWith(USER_ID, ROLE_ID, USER_ID, tx);
	});

	it("fails before creating anything when the default role is not configured", async () => {
		roleService.findByName.mockResolvedValue(null);

		await expect(service.createConsumerAccountInTx(tx, { email: "staff@example.com", passwordHash: "hash", fullName: "Staff Member" })).rejects.toThrow(
			DEFAULT_CONSUMER_ROLE_NAME,
		);
		expect(createUser).not.toHaveBeenCalled();
	});
});
