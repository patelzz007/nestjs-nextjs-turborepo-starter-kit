import { Injectable } from "@nestjs/common";
import type { LoginRestrictedEnrollmentResponse, LoginServiceResponse, LoginVerificationPendingResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { RegistrationSignIn, RegistrationSignInPort } from "../ports/registration-sign-in.port";
import { LoginVerificationGate } from "./login-verification.gate";

/** {@link RegistrationSignInPort}: the login-verification gate, with the team-invite registration as the sign-in method. */
@Injectable()
export class RegistrationSignInApplicationService implements RegistrationSignInPort {
	public constructor(private readonly verification: LoginVerificationGate) {}

	public signInNewAccount(
		actor: ActorContext,
		signIn: RegistrationSignIn,
	): Promise<LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginVerificationPendingResponse> {
		return this.verification.continueLogin(actor, {
			userId: signIn.userId,
			clientType: signIn.clientType,
			deviceInfo: signIn.device.userAgent,
			ipAddress: signIn.device.ipAddress,
			signInMethod: "TEAM_INVITE_REGISTRATION",
			device: signIn.device,
		});
	}
}
