import { Test } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TypedConfigService } from "../../../config/typed-config.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuthorizationCheckerService } from "../../authorization/services/authorization-checker.service";
import { LogService } from "../../logs/logs.service";
import { UserSessionCacheService } from "../cache/user-session-cache.service";
import { UserRepository } from "../repositories/user.repository";
import { SignupReferralCodeError } from "../signup-referrals/signup-referral.errors";
import { SignupReferralService, type AcceptedSignupReferralCode } from "../signup-referrals/signup-referral.service";
import { AuthEventsService } from "./auth-events.service";
import { CryptoService } from "./crypto.service";
import { EmailService } from "./email.service";
import { IdentityService } from "./identity.service";
import { TokenService } from "./token.service";
import { UserProvisioningService } from "./user-provisioning.service";
import { UserResponseMapper } from "./user-response.mapper";

const NEW_USER_ID = "3f0c2a8e-1b7d-4c5e-9a6f-2d8b4e1c7a90";
const CREATED_AT = 1_800_000_000_000;
const GENERIC = { message: "If this email is available, check your inbox for verification instructions." };
const SIGNUP = { email: "new@example.com", password: "StrongP@ss1", fullName: "New Person" };
const ACCEPTED: AcceptedSignupReferralCode = { canonical: "AB23CD45", referrerUserId: "referrer-a", referralCodeId: "code-a" };

function uniqueViolationOn(index: string): Prisma.PrismaClientKnownRequestError {
	return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
		code: "P2002",
		clientVersion: "test",
		meta: { driverAdapterError: { cause: { constraint: { index } } } },
	});
}

describe("IdentityService.signup", () => {
	const createdUser = { id: NEW_USER_ID, email: SIGNUP.email, fullName: SIGNUP.fullName, isActive: true, isSuperAdmin: false, createdAt: BigInt(CREATED_AT) };
	const tx = { user: { create: vi.fn() } };
	const prisma = { $transaction: vi.fn() };
	const userRepo = { existsByEmail: vi.fn() };
	const signupReferrals = { acceptCodeForSignup: vi.fn(), issueFirstCodeInTx: vi.fn(), attachSignupReferralInTx: vi.fn() };
	const userProvisioning = { assignDefaultConsumerRole: vi.fn() };
	const emailService = { sendVerificationEmail: vi.fn() };
	let service: IdentityService;

	beforeEach(async () => {
		vi.resetAllMocks();
		tx.user.create.mockResolvedValue(createdUser);
		prisma.$transaction.mockImplementation(async (handler: (client: typeof tx) => Promise<typeof createdUser>) => handler(tx));
		userRepo.existsByEmail.mockResolvedValue(false);
		signupReferrals.acceptCodeForSignup.mockResolvedValue(null);
		const moduleRef = await Test.createTestingModule({
			providers: [
				IdentityService,
				{ provide: PrismaService, useValue: prisma },
				{ provide: UserRepository, useValue: userRepo },
				{ provide: CryptoService, useValue: { hash: vi.fn().mockResolvedValue("hash") } },
				{ provide: TokenService, useValue: { generateEmailVerificationToken: vi.fn().mockResolvedValue("verify-token") } },
				{ provide: AuthorizationCheckerService, useValue: { getUserPermissionDetails: vi.fn().mockResolvedValue({ roles: [], permissions: [] }) } },
				{ provide: AuthEventsService, useValue: { recordFlow: vi.fn().mockResolvedValue({ recorded: true }) } },
				{ provide: LogService, useValue: { info: vi.fn() } },
				{ provide: UserResponseMapper, useValue: {} },
				{ provide: UserSessionCacheService, useValue: {} },
				{ provide: EmailService, useValue: emailService },
				{ provide: UserProvisioningService, useValue: userProvisioning },
				{ provide: TypedConfigService, useValue: { mfa: { enrollmentDeadlineMs: 0 } } },
				{ provide: SignupReferralService, useValue: signupReferrals },
			],
		}).compile();
		service = moduleRef.get(IdentityService);
	});

	it("creates the user and its first referral code in one transaction, with no signup referral when no code was sent", async () => {
		await expect(service.signup(SIGNUP)).resolves.toEqual(GENERIC);

		expect(signupReferrals.acceptCodeForSignup).toHaveBeenCalledWith(undefined, undefined);
		expect(signupReferrals.issueFirstCodeInTx).toHaveBeenCalledWith(tx, NEW_USER_ID, expect.any(Number));
		expect(signupReferrals.attachSignupReferralInTx).not.toHaveBeenCalled();
		expect(emailService.sendVerificationEmail).toHaveBeenCalledOnce();
	});

	it("attaches the signup referral on the same transaction, dated at the account's creation", async () => {
		signupReferrals.acceptCodeForSignup.mockResolvedValue(ACCEPTED);

		await service.signup({ ...SIGNUP, referralCode: "ab23cd45" }, "web");

		expect(signupReferrals.acceptCodeForSignup).toHaveBeenCalledWith("ab23cd45", "web");
		expect(signupReferrals.attachSignupReferralInTx).toHaveBeenCalledWith(tx, ACCEPTED, { id: NEW_USER_ID, createdAt: CREATED_AT });
	});

	it("answers an invalid code with its validation error before the taken-email disguise", async () => {
		signupReferrals.acceptCodeForSignup.mockRejectedValue(new SignupReferralCodeError("unrecognized"));
		userRepo.existsByEmail.mockResolvedValue(true);

		await expect(service.signup({ ...SIGNUP, referralCode: "ZZZZZZZZ" })).rejects.toBeInstanceOf(SignupReferralCodeError);
		expect(userRepo.existsByEmail).not.toHaveBeenCalled();
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});

	it("gives a taken email with a valid code the generic response and creates nothing", async () => {
		signupReferrals.acceptCodeForSignup.mockResolvedValue(ACCEPTED);
		userRepo.existsByEmail.mockResolvedValue(true);

		await expect(service.signup({ ...SIGNUP, referralCode: "AB23CD45" })).resolves.toEqual(GENERIC);
		expect(prisma.$transaction).not.toHaveBeenCalled();
	});

	it("gives the loser of a concurrent same-email signup the generic response, not an error", async () => {
		prisma.$transaction.mockRejectedValue(uniqueViolationOn("users_email_key"));

		await expect(service.signup(SIGNUP)).resolves.toEqual(GENERIC);
		expect(userProvisioning.assignDefaultConsumerRole).not.toHaveBeenCalled();
		expect(emailService.sendVerificationEmail).not.toHaveBeenCalled();
	});

	it("rethrows a unique violation of any other index", async () => {
		const otherViolation = uniqueViolationOn("signup_referrals_referee_user_id_key");
		prisma.$transaction.mockRejectedValue(otherViolation);

		await expect(service.signup(SIGNUP)).rejects.toBe(otherViolation);
	});

	it("rolls the whole signup back when the code becomes invalid inside the transaction", async () => {
		signupReferrals.acceptCodeForSignup.mockResolvedValue(ACCEPTED);
		signupReferrals.attachSignupReferralInTx.mockRejectedValue(new SignupReferralCodeError("expired"));

		await expect(service.signup({ ...SIGNUP, referralCode: "AB23CD45" })).rejects.toBeInstanceOf(SignupReferralCodeError);
		expect(userProvisioning.assignDefaultConsumerRole).not.toHaveBeenCalled();
	});
});
