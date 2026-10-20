// ============================================
// api-routes.ts - Single source of truth for all API path templates
// ============================================
// Every API endpoint path lives here. Contracts (`contracts/index.ts`) and
// controllers reference this tree instead of hardcoding path strings.
//
// Every leaf is a plain path string. Parameterized segments are written as
// `:param` placeholders; the client router (`endpoints.ts` in @workspace/client)
// substitutes them from the contract's validated input at request time.
//
// Usage:
//   import { apiRoutes } from "@workspace/shared";
//
//   apiRoutes.geo.countries      // "/geo/countries"
//   apiRoutes.geo.countryDetail  // "/geo/countries/:id"

import { authRoutes } from "./contexts/identity/routes";
import { signupReferralsAuthRoutes } from "./contexts/referrals/routes";
import { adminRbacRoutes, capabilitiesRoutes, supportAccessRoutes } from "./contexts/authorization/routes";
import { emailRoutes, merchantInviteEmailPreviewRoutes } from "./contexts/notifications/routes";
import { auditLogsRoutes, auditTrailRoutes, dataChangesRoutes } from "./contexts/audit/routes";
import { githubPicturesRoutes, githubPullRequestsRoutes, githubRoutes } from "./contexts/integrations-github/routes";
import { geoRoutes } from "./contexts/reference-data/routes";
import { legalRoutes, organizationRewardsRoutes, rewardsAdminRewardRoutes, rewardsRoutes } from "./contexts/rewards/routes";
import { claimsRoutes, rewardNotificationsRoutes } from "./contexts/claims/routes";
import { claimsAnalyticsRoutes, organizationAnalyticsRoutes, rewardsAdminAnalyticsRoutes } from "./contexts/reporting/routes";
import { organizationApiKeysRoutes, organizationRedemptionsRoutes, organizationTerminalsRoutes, posRoutes, redemptionsRoutes } from "./contexts/pos/routes";
import { filesRoutes } from "./contexts/files/routes";
import { adminOrganizationsRoutes, organizationsRoutes, rewardsAdminOrganizationRoutes } from "./contexts/organizations/routes";
import { productRoutes, sampleCategoryRoutes } from "./contexts/catalog/routes";
import type { RouteTree } from "./route-tree";

export type { RouteTree } from "./route-tree";

// ── The route tree ─────────────────────────────────────────────────────────
// Composed from each bounded context's `contexts/<context>/routes.ts`. Groups
// mirror the contract tree (auth / email / geo).

export const apiRoutes = {
	auth: {
		...authRoutes,
		...signupReferralsAuthRoutes,
	},
	capabilities: capabilitiesRoutes,
	email: emailRoutes,
	admin: adminRbacRoutes,
	auditLogs: auditLogsRoutes,
	auditTrail: auditTrailRoutes,
	dataChanges: dataChangesRoutes,
	github: githubRoutes,
	githubPullRequests: githubPullRequestsRoutes,
	githubPictures: githubPicturesRoutes,
	geo: geoRoutes,
	rewards: rewardsRoutes,
	legal: legalRoutes,
	claims: {
		...claimsRoutes,
		...claimsAnalyticsRoutes,
	},
	rewardNotifications: rewardNotificationsRoutes,
	pos: posRoutes,
	redemptions: redemptionsRoutes,
	files: filesRoutes,
	organizations: {
		...organizationsRoutes,
		...organizationAnalyticsRoutes,
		...organizationRedemptionsRoutes,
		rewards: organizationRewardsRoutes,
		terminals: organizationTerminalsRoutes,
		apiKeys: organizationApiKeysRoutes,
	},
	adminOrganizations: adminOrganizationsRoutes,
	supportAccess: supportAccessRoutes,
	rewardsAdmin: {
		...rewardsAdminOrganizationRoutes,
		...merchantInviteEmailPreviewRoutes,
		...rewardsAdminRewardRoutes,
		...rewardsAdminAnalyticsRoutes,
	},
	sampleCategory: sampleCategoryRoutes,
	product: productRoutes,
} satisfies Record<string, RouteTree>;

/** The full route tree — exported for type-level access. */
export type ApiRoutes = typeof apiRoutes;
