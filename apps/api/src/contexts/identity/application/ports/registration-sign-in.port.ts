import type { LoginRestrictedEnrollmentResponse, LoginServiceResponse, LoginVerificationPendingResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { SessionDeviceContext } from "../../domain/value-objects/session-device.value-object";

/** An account another context just created, signing in for the first time. */
export interface RegistrationSignIn {
	readonly userId: string;
	/** The app the account signs in to (its cookies and its verification links). */
	readonly clientType: string;
	readonly device: SessionDeviceContext;
}

/**
 * The post-credential step of a registration flow owned by another context (tenants' team
 * invite registration): the same session issue as a login, under the login-verification policy, so a
 * new device may still have to confirm an emailed code. The plaintext password is never replayed
 * through the login path.
 */
export interface RegistrationSignInPort {
	signInNewAccount(actor: ActorContext, signIn: RegistrationSignIn): Promise<LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginVerificationPendingResponse>;
}
