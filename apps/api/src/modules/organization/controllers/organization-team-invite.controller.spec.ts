import { Test } from "@nestjs/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { captureFastifyRequest } from "../../../../test/support/fastify-request";
import { LoginVerificationService } from "../../auth/services/login-verification.service";
import { OrganizationMembershipService } from "../services/organization-membership.service";
import { OrganizationTeamInviteController } from "./organization-team-invite.controller";

vi.mock("../../auth/services/login-verification.service", () => ({ LoginVerificationService: class {} }));
// The cookie interceptor is exercised by its own spec; here it only needs to be constructible.
vi.mock("../../auth/interceptors/set-auth-cookies.interceptor", () => ({ SetAuthCookiesInterceptor: class {} }));
vi.mock("../services/organization-membership.service", () => ({ OrganizationMembershipService: class {} }));

const USER_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
const PASSWORD = "Str0ng!Passw0rd";

describe("OrganizationTeamInviteController.registerAndAcceptTeamInvite", () => {
	let controller: OrganizationTeamInviteController;
	const membership = { registerAndAcceptTeamInvite: vi.fn() };
	const loginVerification = { maybeRequireVerification: vi.fn() };

	beforeEach(async () => {
		vi.clearAllMocks();
		membership.registerAndAcceptTeamInvite.mockResolvedValue({ organizationSlug: "brew", message: "Invitation accepted", userId: USER_ID, email: "staff@example.com" });
		loginVerification.maybeRequireVerification.mockResolvedValue({ requiresVerification: true, verificationId: "v-1", message: "Check your email" });
		const moduleRef = await Test.createTestingModule({
			controllers: [OrganizationTeamInviteController],
			providers: [
				{ provide: OrganizationMembershipService, useValue: membership },
				{ provide: LoginVerificationService, useValue: loginVerification },
			],
		}).compile();
		controller = moduleRef.get(OrganizationTeamInviteController);
	});

	it("issues the session from the created identity — the plaintext password never re-enters a login path", async () => {
		const request = await captureFastifyRequest({ headers: { "user-agent": "vitest" } });

		await controller.registerAndAcceptTeamInvite({ token: "0123456789abcdef0123456789abcdef", fullName: "Staff Member", password: PASSWORD }, "merchant", request);

		expect(loginVerification.maybeRequireVerification).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_ID, clientType: "merchant" }));
		expect(JSON.stringify(loginVerification.maybeRequireVerification.mock.calls)).not.toContain(PASSWORD);
	});
});
