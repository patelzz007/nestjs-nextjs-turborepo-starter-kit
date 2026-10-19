// ============================================
// contexts/identity — the context's public surface
// ============================================
// Identity — signing in and out, two-factor, devices (sessions) and the person's own profile.
// Code outside this folder (routes in src/app, runtime features, screen tests)
// imports from here, never from a file inside it
// (docs/architecture/ddd-cqrs-migration-plan.md §14.5).

export { type DemoAccount, useDemoAccounts } from "./auth/demo-accounts";
export { EXPIRED_STEP_MESSAGE, TwoFactorRouteParamsSchema, VerifyDeviceRouteParamsSchema } from "./auth/sign-in-steps";
export { SignOutDialog } from "./auth/sign-out-dialog";
export { useRefreshSession } from "./auth/use-refresh-session";
export { useSignInStepHandler } from "./auth/use-sign-in-step";
export { useSignOut } from "./auth/use-sign-out";
export { useSignOutConfirmation } from "./auth/use-sign-out-confirmation";
export { DEVICES_COPY } from "./devices/labels";
export { clientTypeLabelOf, platformLineOf, sessionDetailItems } from "./devices/session-details";
export { SignOutEverywhere } from "./devices/sign-out-everywhere";
export { DemoDatesSection } from "./profile/demo-dates-section";
export { applyOwnProfileUpdated, applyOwnProfileUpdateFailed, isStaleProfileVersionError, STALE_PROFILE_MESSAGE } from "./profile/own-profile-cache";
export { backupCodesNotice } from "./two-factor/backup-codes-status";
export { twoFactorEnrollmentTitleOf } from "./two-factor/labels";
export { NO_AUTHENTICATOR_MESSAGE, TwoFactorEnrollment, TwoFactorEnrollmentModeSchema } from "./two-factor/two-factor-enrollment";
