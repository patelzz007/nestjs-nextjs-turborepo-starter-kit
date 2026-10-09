import { Test } from "@nestjs/testing";
import { AdminUserListQuerySchema } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../../../prisma/prisma.service";
import { AuthorizationCheckerService } from "../../authorization/services/authorization-checker.service";
import { LogService } from "../../logs/logs.service";
import { UserRepository } from "../repositories/user.repository";
import { SignupReferralRepository, type AdminSignupReferralSummary } from "../signup-referrals/signup-referral.repository";
import { AdminUserService } from "./admin-user.service";
import { UserResponseMapper } from "./user-response.mapper";

const CREATED_AT = 1_800_000_000_000;
const REFERRER_A = { id: "8c1b6d2e-4f3a-4b5c-9d6e-7f8a9b0c1d2e", fullName: "Alice Referrer" };

function adminRow(id: string): object {
	return {
		id,
		email: `${id}@example.com`,
		fullName: `User ${id}`,
		isActive: true,
		isSuperAdmin: false,
		emailVerifiedAt: null,
		twoFactorEnabled: false,
		tokenVersion: 0,
		createdAt: BigInt(CREATED_AT),
		updatedAt: BigInt(CREATED_AT),
		isDeleted: false,
		deletedAt: null,
		failedLoginAttempts: 0,
		lockedUntil: null,
	};
}

describe("AdminUserService signup referral facts", () => {
	const userRepo = { listAdminUsers: vi.fn() };
	const prisma = { userRole: { findMany: vi.fn() } };
	const signupReferrals = { findAdminSummariesForReferees: vi.fn(), findAdminSummaryForReferee: vi.fn() };
	let service: AdminUserService;

	beforeEach(async () => {
		vi.clearAllMocks();
		prisma.userRole.findMany.mockResolvedValue([]);
		const moduleRef = await Test.createTestingModule({
			providers: [
				AdminUserService,
				{ provide: PrismaService, useValue: prisma },
				{ provide: UserRepository, useValue: userRepo },
				{ provide: AuthorizationCheckerService, useValue: {} },
				{ provide: LogService, useValue: {} },
				{ provide: UserResponseMapper, useValue: {} },
				{ provide: SignupReferralRepository, useValue: signupReferrals },
			],
		}).compile();
		service = moduleRef.get(AdminUserService);
	});

	it("loads the page's referral facts in ONE batched read and maps a referee and a non-referee", async () => {
		userRepo.listAdminUsers.mockResolvedValue({
			items: [adminRow("referee-b"), adminRow("plain-a")],
			total: 2,
			page: 1,
			totalPages: 1,
			nextCursor: null,
			hasNext: false,
			hasPrevious: false,
		});
		const summaries: ReadonlyMap<string, AdminSignupReferralSummary> = new Map([["referee-b", { referrer: REFERRER_A, status: "redeemed" }]]);
		signupReferrals.findAdminSummariesForReferees.mockResolvedValue(summaries);

		const page = await service.getAdminUsersList(AdminUserListQuerySchema.parse({}));

		expect(signupReferrals.findAdminSummariesForReferees).toHaveBeenCalledOnce();
		expect(signupReferrals.findAdminSummariesForReferees).toHaveBeenCalledWith(["referee-b", "plain-a"]);
		expect(page.items.map((item) => ({ id: item.id, signupReferrer: item.signupReferrer, signupReferralStatus: item.signupReferralStatus }))).toEqual([
			{ id: "referee-b", signupReferrer: REFERRER_A, signupReferralStatus: "redeemed" },
			{ id: "plain-a", signupReferrer: null, signupReferralStatus: null },
		]);
	});
});
