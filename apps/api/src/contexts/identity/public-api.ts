/*
 * The ONLY file other contexts (and the platform security kit) may import from identity (§6.4).
 *
 * `IdentityModule` (identity.module.ts) is a global composition module mounted by `AppModule` only;
 * it is deliberately not exported here (contexts reach identity's providers by token, which keeps the
 * module graph acyclic). It provides:
 * - `ACCOUNT_PROVISIONING` (`AccountProvisioningPort`, platform port): tenants' invite
 *   registration and merchant onboarding.
 * - `REGISTRATION_SIGN_IN` (`RegistrationSignInPort`): the first sign-in of an account tenants
 *   just registered from a team invite (login-verification policy applies).
 * - `IDENTITY_SESSIONS` (`IdentitySessionsPortFactory`, platform port): authorization revokes sessions
 *   and bumps `tokenVersion` inside its RBAC transaction.
 * - The security kit's ports (`ACCESS_TOKEN_VERIFIER`, `ACCESS_TOKEN_STATE`, `IMPERSONATION_TOKEN_CHECK`,
 *   `AUTH_FLOW_RECORDER`, platform `access-token.port.ts`).
 *
 * Identity consumes `MERCHANT_PORTAL_ACCESS` (`MerchantPortalAccessPort`), which tenants implements.
 * `createIdentityTransactionalPorts(db, …)` binds identity's ports to another context's transaction
 * (only that context's `infrastructure/` may call it).
 */
export type { SessionDeviceContext, SessionDeviceDetails } from "./domain/value-objects/session-device.value-object";
export type { MerchantPortalAccess, MerchantPortalAccessPort } from "./application/ports/merchant-portal-access.port";
export type { ConsumerClaimant, ConsumerClaimantPort } from "./application/ports/consumer-claimant.port";
export type { RegistrationSignIn, RegistrationSignInPort } from "./application/ports/registration-sign-in.port";
export { MERCHANT_PORTAL_ACCESS, REGISTRATION_SIGN_IN } from "./application/ports/identity.tokens";
export {
	createIdentityTransactionalPorts,
	type IdentityTransactionalDependencies,
	type IdentityTransactionalPorts,
} from "./infrastructure/persistence/identity-transactional-ports";
