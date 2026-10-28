// ============================================
// contracts/index.ts - The shared API contract
// ============================================
// The single source of truth for every route the client router (`endpoints.ts`
// in @workspace/client) and the NestJS API agree on: HTTP method, path
// template, the ONE zod input schema both sides use, and the response
// contract (ADR 022) both sides enforce.
//
// - The client router derives its defs from `apiContract` (path/method/input/
//   response come from here; the client only adds react-query key concerns)
//   and parses every response body with `response.envelope`.
// - The API validates at the HTTP boundary with the SAME input schemas
//   (`@ZodBody(apiContract.auth.login.input)`) and decorates each handler with
//   the SAME response schema (`@ZodResponse(…)` / `@ZodPaginatedResponse(…)`);
//   `apps/api/test/openapi-document.e2e-spec.ts` fails when a leaf and its
//   handler disagree, so neither half can drift.
//
// Inputs are JSON-only (`SerializableInput`), mirroring the client pipeline's
// constraints — no erasure, no casts, full autocomplete on both sides.

import { authContract } from "../contexts/identity/contract";
import { rewardReferralsContract, signupReferralsAuthContract } from "../contexts/referrals/contract";
import { adminRbacContract, capabilitiesContract, supportAccessContract, tenantAccessContract } from "../contexts/authorization/contract";
import { emailContract, merchantInviteEmailPreviewContract } from "../contexts/notifications/contract";
import { auditLogsContract, auditTrailContract, dataChangesContract } from "../contexts/audit/contract";
import { githubContract, githubPullRequestsContract } from "../contexts/integrations-github/contract";
import { geoContract } from "../contexts/reference-data/contract";
import { integrationRewardsContract, legalContract, tenantRewardsContract, rewardsAdminRewardContract, rewardsContract } from "../contexts/rewards/contract";
import { claimsContract, rewardNotificationsContract } from "../contexts/claims/contract";
import { claimsAnalyticsContract, integrationAnalyticsContract, tenantAnalyticsContract, rewardsAdminAnalyticsContract } from "../contexts/reporting/contract";
import { integrationRedemptionsContract, tenantApiKeysContract, tenantRedemptionsContract, tenantTerminalsContract } from "../contexts/pos/contract";
import { filesContract } from "../contexts/files/contract";
import { adminTenantsContract, tenantsContract, rewardsAdminTenantContract } from "../contexts/tenancy/contract";
import { productContract, sampleCategoryContract } from "../contexts/catalog/contract";
import { kanbanContract } from "../contexts/kanban/contract";
import { operationsContract } from "../contexts/operations/contract";

// ── JSON-safe value types (shared by the contract and the client pipeline) ─
// Canonical definitions live in `schemas/api/common.ts` to avoid duplicate
// exports. Re-exported here so consumers importing from `@workspace/shared`
// get them from either path.
import type { DataPrimitive, DataValue } from "../schemas/api/common";
export type { DataPrimitive, DataValue };

export type { SerializableInput, RestMethod, ApiAccess, ApiContractDef, ApiFileContractDef } from "./define-contract";
export { ApiAccessSchema, defineContract, defineFileContract } from "./define-contract";

// ── API versioning ─────────────────────────────────────────────────────────
// The version constants (`API_VERSION`, `apiPath`, `apiDocsPath`, …) live in
// `./versioning` — a dependency-free module — so schemas can import them
// Re-exported here for the public `@workspace/shared`
// surface; anything that only needs the constants can import `./versioning`.
export * from "./versioning";
export * from "./idempotency";
export * from "./mutation-intent";
export * from "./request-context-headers";
export * from "./client-session";
export { contractPathParam } from "./path-param";
export { fileResponse, paginatedResponse, singleResponse, type ApiFileResponseContract, type ApiResponseContract, type ApiResponseKind } from "./response";

// ── The contract ───────────────────────────────────────────────────────────
// Composed from each bounded context's `contexts/<context>/contract.ts` (plan §14.1).
// Groups mirror the client router; nested groups (`tenants.rewards`, …) are
// composed here so keys, methods and paths stay identical.
//
// To add a new feature: see docs/technical/adding-a-feature.md
//
// NOTE: the version manifest (`GET /version`) is deliberately NOT a
// contract leaf — it is UNVERSIONED (the thing clients use to FIND the
// current version must never move when a major bumps). The client transport
// fetches `${API_BASE_URL}/version` directly and parses it with
// `ApiVersionManifestSchema` from @workspace/shared.

export const apiContract = {
	auth: {
		...authContract,
		...signupReferralsAuthContract,
	},
	capabilities: capabilitiesContract,
	admin: adminRbacContract,
	supportAccess: supportAccessContract,
	tenantAccess: tenantAccessContract,
	referrals: rewardReferralsContract,
	auditLogs: auditLogsContract,
	auditTrail: auditTrailContract,
	dataChanges: dataChangesContract,
	email: emailContract,
	github: githubContract,
	githubPullRequests: githubPullRequestsContract,
	geo: geoContract,
	rewards: rewardsContract,
	legal: legalContract,
	claims: {
		...claimsContract,
		...claimsAnalyticsContract,
	},
	rewardNotifications: rewardNotificationsContract,
	files: filesContract,
	tenants: {
		...tenantsContract,
		...tenantAnalyticsContract,
		...tenantRedemptionsContract,
		rewards: tenantRewardsContract,
		terminals: tenantTerminalsContract,
		apiKeys: tenantApiKeysContract,
	},
	integration: {
		...integrationAnalyticsContract,
		...integrationRedemptionsContract,
		rewards: integrationRewardsContract,
	},
	adminTenants: adminTenantsContract,
	rewardsAdmin: {
		...rewardsAdminTenantContract,
		...merchantInviteEmailPreviewContract,
		...rewardsAdminRewardContract,
		...rewardsAdminAnalyticsContract,
	},
	sampleCategory: sampleCategoryContract,
	product: productContract,
	kanban: kanbanContract,
	operations: operationsContract,
};

/** The full contract tree — used to derive the client router + API pipes. */
export type ApiContract = typeof apiContract;
