import { HttpStatus, RequestMethod } from "@nestjs/common";
import {
	API_VERSION_PREFIX,
	MerchantApiKeyCreatedSchema,
	MerchantApiKeySummarySchema,
	MerchantRedemptionListItemSchema,
	MerchantTerminalPairingSchema,
	MerchantTerminalSettingsResponseSchema,
	MerchantTerminalStatusSummarySchema,
	MerchantTerminalSummarySchema,
	OkResponseSchema,
	PosPairedTerminalSchema,
	RedemptionCheckoutResponseSchema,
	RedemptionPreviewResponseSchema,
} from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { controllerOf, handlerOf, metadataOf, routeOf } from "../../../../../../test/support/route-metadata";
import { ALLOW_API_KEY_AUTH_KEY } from "../../../../../platform/presentation/http/security/api-keys/api-key-request";
import { IS_PUBLIC_KEY } from "../../../../../platform/presentation/http/security/decorators/public.decorator";
import { SKIP_MUTATION_INTENT_KEY } from "../../../../../platform/presentation/http/security/decorators/skip-mutation-intent.decorator";
import { MerchantApiKeyGuard } from "../../../../../platform/presentation/http/security/guards/merchant-api-key.guard";
import { MerchantActorInterceptor } from "../../../../../platform/presentation/http/security/interceptors/merchant-actor.interceptor";
import { RATE_LIMIT_POLICY, RATE_LIMIT_POLICY_KEY } from "../../../../../platform/presentation/http/security/throttling/rate-limit.decorator";
import { PosRateLimitGuard } from "../guards/pos-rate-limit.guard";
import { OrganizationApiKeysController } from "../organization-api-keys.controller";
import { OrganizationRedemptionsController } from "../organization-redemptions.controller";
import { OrganizationTerminalsController, PosTerminalsController } from "../organization-terminals.controller";
import { RedemptionsController } from "../redemptions.controller";

/** One route of a controller: method name → its verb, path, response contract and guards. */
interface ExpectedRoute {
	readonly name: string;
	readonly method: RequestMethod;
	readonly path: string;
	readonly kind: "single" | "paginated";
	readonly schema: object;
	readonly status: HttpStatus;
	readonly guards?: readonly object[];
}

/** Every route keeps its verb, path and guards, and exactly one response contract (one documented 2xx). */
function expectRoutes(prototype: object, routes: readonly ExpectedRoute[]): void {
	for (const route of routes) {
		const metadata = routeOf(prototype, route.name);
		expect({ name: route.name, path: metadata.path, method: metadata.method, guards: metadata.guards }).toEqual({
			name: route.name,
			path: route.path,
			method: route.method,
			guards: route.guards ?? [],
		});
		expect(metadata.contract).toMatchObject({ kind: route.kind, schema: route.schema });
		expect(metadata.successStatuses).toEqual([String(route.status)]);
	}
}

describe("pos controllers keep every route and its decorators", () => {
	it("checks a till's codes out under /redemptions: public, key-guarded, rate-limited per key, no mutation-intent header", () => {
		expect(controllerOf(RedemptionsController)).toEqual({ path: `${API_VERSION_PREFIX}/redemptions`, interceptors: [] });
		expect(metadataOf(SKIP_MUTATION_INTENT_KEY, RedemptionsController)).toBe(true);
		const guards = [MerchantApiKeyGuard, PosRateLimitGuard];
		expectRoutes(RedemptionsController.prototype, [
			{ name: "validate", method: RequestMethod.POST, path: "validate", kind: "single", schema: RedemptionPreviewResponseSchema, status: HttpStatus.CREATED, guards },
			{ name: "checkout", method: RequestMethod.POST, path: "checkout", kind: "single", schema: RedemptionCheckoutResponseSchema, status: HttpStatus.CREATED, guards },
		]);
		for (const name of ["validate", "checkout"]) {
			expect(metadataOf(IS_PUBLIC_KEY, handlerOf(RedemptionsController.prototype, name))).toBe(true);
		}
	});

	it("manages terminals under /orgs/:orgSlug/terminals through the merchant actor, writes rate-limited", () => {
		expect(controllerOf(OrganizationTerminalsController)).toEqual({ path: `${API_VERSION_PREFIX}/orgs/:orgSlug/terminals`, interceptors: [MerchantActorInterceptor] });
		const prototype = OrganizationTerminalsController.prototype;
		expectRoutes(prototype, [
			{ name: "list", method: RequestMethod.GET, path: "/", kind: "paginated", schema: MerchantTerminalSummarySchema, status: HttpStatus.OK },
			{ name: "create", method: RequestMethod.POST, path: "/", kind: "single", schema: MerchantTerminalPairingSchema, status: HttpStatus.CREATED },
			{ name: "summary", method: RequestMethod.GET, path: "summary", kind: "single", schema: MerchantTerminalStatusSummarySchema, status: HttpStatus.OK },
			{ name: "getSettings", method: RequestMethod.GET, path: "settings", kind: "single", schema: MerchantTerminalSettingsResponseSchema, status: HttpStatus.OK },
			{ name: "updateSettings", method: RequestMethod.PATCH, path: "settings", kind: "single", schema: MerchantTerminalSettingsResponseSchema, status: HttpStatus.OK },
			{ name: "get", method: RequestMethod.GET, path: ":id", kind: "single", schema: MerchantTerminalSummarySchema, status: HttpStatus.OK },
			{ name: "issuePairingCode", method: RequestMethod.POST, path: ":id/pairing-code", kind: "single", schema: MerchantTerminalPairingSchema, status: HttpStatus.CREATED },
			{ name: "remove", method: RequestMethod.DELETE, path: ":id", kind: "single", schema: OkResponseSchema, status: HttpStatus.OK },
		]);
		for (const name of ["create", "updateSettings", "issuePairingCode", "remove"]) {
			expect(metadataOf(RATE_LIMIT_POLICY_KEY, handlerOf(prototype, name))).toBe(RATE_LIMIT_POLICY.authenticatedMutation.name);
		}
	});

	it("pairs a till at /pos/terminals/pair: public, pairing-rate-limited, no mutation-intent header", () => {
		expect(controllerOf(PosTerminalsController)).toEqual({ path: `${API_VERSION_PREFIX}/pos/terminals`, interceptors: [] });
		expect(metadataOf(SKIP_MUTATION_INTENT_KEY, PosTerminalsController)).toBe(true);
		expectRoutes(PosTerminalsController.prototype, [
			{ name: "pair", method: RequestMethod.POST, path: "pair", kind: "single", schema: PosPairedTerminalSchema, status: HttpStatus.CREATED },
		]);
		const pair = handlerOf(PosTerminalsController.prototype, "pair");
		expect(metadataOf(IS_PUBLIC_KEY, pair)).toBe(true);
		expect(metadataOf(RATE_LIMIT_POLICY_KEY, pair)).toBe(RATE_LIMIT_POLICY.terminalPairing.name);
	});

	it("manages API keys under /orgs/:orgSlug/api-keys through the merchant actor, writes rate-limited", () => {
		expect(controllerOf(OrganizationApiKeysController)).toEqual({ path: `${API_VERSION_PREFIX}/orgs/:orgSlug/api-keys`, interceptors: [MerchantActorInterceptor] });
		const prototype = OrganizationApiKeysController.prototype;
		expectRoutes(prototype, [
			{ name: "listKeys", method: RequestMethod.GET, path: "/", kind: "paginated", schema: MerchantApiKeySummarySchema, status: HttpStatus.OK },
			{ name: "createKey", method: RequestMethod.POST, path: "/", kind: "single", schema: MerchantApiKeyCreatedSchema, status: HttpStatus.CREATED },
			{ name: "revokeKey", method: RequestMethod.POST, path: ":keyId/revoke", kind: "single", schema: OkResponseSchema, status: HttpStatus.CREATED },
		]);
		for (const name of ["createKey", "revokeKey"]) {
			expect(metadataOf(RATE_LIMIT_POLICY_KEY, handlerOf(prototype, name))).toBe(RATE_LIMIT_POLICY.authenticatedMutation.name);
		}
	});

	it("lists redemptions under /orgs/:orgSlug/redemptions for members and API keys alike", () => {
		expect(controllerOf(OrganizationRedemptionsController)).toEqual({ path: `${API_VERSION_PREFIX}/orgs/:orgSlug/redemptions`, interceptors: [MerchantActorInterceptor] });
		expect(metadataOf(ALLOW_API_KEY_AUTH_KEY, OrganizationRedemptionsController)).toBeDefined();
		expectRoutes(OrganizationRedemptionsController.prototype, [
			{ name: "listRedemptions", method: RequestMethod.GET, path: "/", kind: "paginated", schema: MerchantRedemptionListItemSchema, status: HttpStatus.OK },
		]);
	});
});
