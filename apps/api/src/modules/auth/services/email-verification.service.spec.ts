import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { UserRepository } from "../repositories/user.repository";
import { AuthEventsService } from "./auth-events.service";
import { EmailService } from "./email.service";
import { EmailVerificationService } from "./email-verification.service";
import { IdentityService } from "./identity.service";
import { TokenService } from "./token.service";

const mocks = vi.hoisted(() => ({
	verifyEmailToken: vi.fn<(token: string) => Promise<string>>(),
	findProfileByEmail: vi.fn<(email: string) => Promise<{ readonly id: string; readonly emailVerifiedAt: bigint | null } | null>>(),
	markEmailVerifiedIfUnverified: vi.fn<(id: string, verifiedAt: number) => Promise<boolean>>(),
	invalidateMe: vi.fn<(userId: string) => void>(),
	recordFlow: vi.fn<() => Promise<{ readonly recorded: boolean }>>(),
}));

const USER_ID = "user-1";

async function createService(): Promise<EmailVerificationService> {
	const moduleRef = await Test.createTestingModule({
		providers: [
			EmailVerificationService,
			{ provide: TokenService, useValue: { verifyEmailToken: mocks.verifyEmailToken } },
			{ provide: UserRepository, useValue: { findProfileByEmail: mocks.findProfileByEmail, markEmailVerifiedIfUnverified: mocks.markEmailVerifiedIfUnverified } },
			{ provide: IdentityService, useValue: { invalidateMe: mocks.invalidateMe } },
			{ provide: AuthEventsService, useValue: { recordFlow: mocks.recordFlow } },
			{ provide: EmailService, useValue: {} },
		],
	})
		.useMocker((token) => {
			throw new Error(`Unexpected dependency ${String(token)}`);
		})
		.compile();
	return moduleRef.get(EmailVerificationService);
}

describe("EmailVerificationService.verifyEmail", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.verifyEmailToken.mockResolvedValue("ada@example.com");
		mocks.recordFlow.mockResolvedValue({ recorded: true });
	});

	it("verifies an unverified address with one conditional write and reports alreadyVerified: false", async () => {
		mocks.findProfileByEmail.mockResolvedValue({ id: USER_ID, emailVerifiedAt: null });
		mocks.markEmailVerifiedIfUnverified.mockResolvedValue(true);
		const service = await createService();

		await expect(service.verifyEmail("token")).resolves.toEqual({ message: "Email verified successfully", alreadyVerified: false });
		expect(mocks.markEmailVerifiedIfUnverified).toHaveBeenCalledWith(USER_ID, expect.any(Number));
		expect(mocks.invalidateMe).toHaveBeenCalledWith(USER_ID);
	});

	it("reports alreadyVerified: true for an address verified earlier, without writing", async () => {
		mocks.findProfileByEmail.mockResolvedValue({ id: USER_ID, emailVerifiedAt: BigInt(1) });
		const service = await createService();

		await expect(service.verifyEmail("token")).resolves.toEqual({ message: "Email already verified", alreadyVerified: true });
		expect(mocks.markEmailVerifiedIfUnverified).not.toHaveBeenCalled();
	});

	it("reports alreadyVerified: true when a concurrent request verified the address first (the conditional write matched nothing)", async () => {
		mocks.findProfileByEmail.mockResolvedValue({ id: USER_ID, emailVerifiedAt: null });
		mocks.markEmailVerifiedIfUnverified.mockResolvedValue(false);
		const service = await createService();

		await expect(service.verifyEmail("token")).resolves.toEqual({ message: "Email already verified", alreadyVerified: true });
		expect(mocks.invalidateMe).not.toHaveBeenCalled();
	});
});
