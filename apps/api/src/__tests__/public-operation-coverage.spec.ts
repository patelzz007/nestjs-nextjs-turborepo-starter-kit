import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { SystemOperationNameSchema } from "../platform/application/system-operation-names";
import { IS_PUBLIC_KEY } from "../platform/presentation/http/security/decorators/public.decorator";
import { PLATFORM_OPERATION_KEY } from "../platform/presentation/http/security/decorators/platform-operation.decorator";
import { PUBLIC_OPERATION_KEY } from "../platform/presentation/http/security/decorators/public-operation.decorator";
import { discoverControllerRoutes, routeMetadataOf, type ControllerRoute } from "../../test/support/controller-routes";

/** Which decorator replaced a handler's old route-wide bypass, and the operation it names. */
interface Replacement {
	readonly decorator: "public" | "platform";
	readonly operation: string;
}

/**
 * Every handler that carried `@RlsBypass()` before MT-43 (the route-wide bypass, now deleted),
 * and what it runs under instead: its own narrowed operation. Admin-console handlers name a
 * `@PlatformOperation`; every other one names a `@PublicOperation`.
 */
const FORMER_RLS_BYPASS_HANDLERS: ReadonlyMap<string, Replacement> = new Map<string, Replacement>([
	["CapabilitiesCatalogController.listCatalog", { decorator: "public", operation: "authorization.capability_catalog.read" }],
	["FilesController.processingCallback", { decorator: "public", operation: "files.scan_verdict.apply" }],
	["LocalStorageTransferController.localDownload", { decorator: "public", operation: "files.local_object.read" }],
	["LocalStorageTransferController.localPublic", { decorator: "public", operation: "files.local_object.read" }],
	["LocalStorageTransferController.localPublicVariant", { decorator: "public", operation: "files.local_variant.read" }],
	["LocalStorageTransferController.localUpload", { decorator: "public", operation: "files.local_object.read" }],
	["AuthController.signup", { decorator: "public", operation: "auth.signup.register" }],
	["AuthController.login", { decorator: "public", operation: "auth.principal.lookup" }],
	["AuthController.resendVerification", { decorator: "public", operation: "auth.email_verification.send" }],
	["AuthController.forgotPassword", { decorator: "public", operation: "auth.password_reset.request" }],
	["AuthController.resetPassword", { decorator: "public", operation: "auth.password_reset.complete" }],
	["AuthController.validateResetToken", { decorator: "public", operation: "auth.password_reset.lookup" }],
	["AuthController.verifyLogin", { decorator: "public", operation: "auth.principal.lookup" }],
	["AuthController.verifyEmail", { decorator: "public", operation: "auth.email_verification.confirm" }],
	["ImpersonationController.stopImpersonation", { decorator: "public", operation: "auth.principal.lookup" }],
	["TwoFactorController.loginWithTwoFactor", { decorator: "public", operation: "auth.principal.lookup" }],
	["TwoFactorController.loginWithBackupCode", { decorator: "public", operation: "auth.principal.lookup" }],
	["EmailWebhookController.receive", { decorator: "public", operation: "email.log.write" }],
	["TenantTeamInviteController.registerAndAcceptTeamInvite", { decorator: "public", operation: "tenant.invitation.register_and_accept" }],
	["RewardsAdminMerchantsController.updateKyb", { decorator: "platform", operation: "tenant.kyb.admin_decide" }],
	["RewardsAdminAnalyticsController.exportReport", { decorator: "platform", operation: "reporting.platform_analytics.read" }],
	["RewardsAdminRewardsController.downloadRewardImagesArchive", { decorator: "platform", operation: "rewards.admin_review" }],
]);

function replacementOf(route: ControllerRoute): Replacement | undefined {
	const platform = routeMetadataOf(route, PLATFORM_OPERATION_KEY);
	const publicFlow = routeMetadataOf(route, PUBLIC_OPERATION_KEY);
	if (platform !== undefined) {
		return { decorator: "platform", operation: SystemOperationNameSchema.parse(platform) };
	}
	return publicFlow === undefined ? undefined : { decorator: "public", operation: SystemOperationNameSchema.parse(publicFlow) };
}

describe("MT-43: public operations replace the route-wide RLS bypass", () => {
	let routes: readonly ControllerRoute[] = [];

	beforeAll(async () => {
		routes = await discoverControllerRoutes(resolve(import.meta.dirname, ".."));
	});

	it("gives every handler that was @RlsBypass its own named operation", () => {
		const byId: ReadonlyMap<string, ControllerRoute> = new Map(routes.map((route): [string, ControllerRoute] => [route.id, route]));
		for (const [id, expected] of FORMER_RLS_BYPASS_HANDLERS) {
			const route: ControllerRoute | undefined = byId.get(id);
			expect(route, id).toBeDefined();
			if (route !== undefined) {
				expect({ id, replacement: replacementOf(route) }).toEqual({ id, replacement: expected });
			}
		}
	});

	it("never runs an unauthenticated (@Public) route under an admin-console operation", () => {
		const publicUnderPlatform: string[] = routes
			.filter((route): boolean => routeMetadataOf(route, IS_PUBLIC_KEY) === true && routeMetadataOf(route, PLATFORM_OPERATION_KEY) !== undefined)
			.map((route): string => route.id);

		expect(publicUnderPlatform).toEqual([]);
	});
});
