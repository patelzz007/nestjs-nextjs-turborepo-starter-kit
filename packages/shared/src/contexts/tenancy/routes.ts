// API path templates owned by the `tenants` context. Composed into `apiRoutes`
// (`src/api-routes.ts`) with identical keys and values.

import type { RouteTree } from "../../route-tree";

/** Path templates composed into `apiRoutes.rewardsAdmin`. */
export const rewardsAdminTenantRoutes = {
	invites: "/admin/invites",
	inviteAvailability: "/admin/invites/availability",
	merchants: "/admin/merchants",
	tenantDetail: "/admin/merchants/:tenantId",
	tenantKyb: "/admin/merchants/:tenantId/kyb",
	locationRequests: "/admin/location-requests",
	locationCreate: "/admin/merchants/:tenantId/locations",
	locationReview: "/admin/merchants/:tenantId/locations/:locationId/review",
	tenantKybDocumentDownload: "/admin/merchants/:tenantId/documents/:documentId/download",
} satisfies Record<string, RouteTree>;

/** Path templates composed into `apiRoutes.tenants`. */
export const tenantsRoutes = {
	membershipsBootstrap: "/tenants/memberships",
	context: "/tenants/:tenantSlug/context",
	accessRequests: "/tenants/:tenantSlug/access-requests",
	reviewAccessRequest: "/tenants/:tenantSlug/access-requests/:requestId/review",
	inviteMember: "/tenants/:tenantSlug/members/invite",
	listMembers: "/tenants/:tenantSlug/members",
	ownMembership: "/tenants/:tenantSlug/members/me",
	listMemberInvites: "/tenants/:tenantSlug/members/invites",
	revokeMemberInvite: "/tenants/:tenantSlug/members/invites/:inviteId/revoke",
	removeMemberFromStore: "/tenants/:tenantSlug/members/:membershipId/stores/:locationId/remove",
	teamInvites: {
		validate: "/tenants/invites/validate",
		accept: "/tenants/invites/accept",
		registerAndAccept: "/tenants/invites/register-and-accept",
	},
	kyb: "/tenants/:tenantSlug/kyb",
	kybDocumentDownload: "/tenants/:tenantSlug/kyb/documents/:documentId/download",
	locations: {
		create: "/tenants/:tenantSlug/locations",
		update: "/tenants/:tenantSlug/locations/:locationId",
		close: "/tenants/:tenantSlug/locations/:locationId/close",
	},
	onboarding: {
		validate: "/tenants/onboarding/validate",
		complete: "/tenants/onboarding/complete",
		documentUploadUrl: "/tenants/onboarding/documents/upload-url",
		documentBatchUploadUrl: "/tenants/onboarding/documents/upload-urls",
		documentUploadComplete: "/tenants/onboarding/documents/upload-complete",
		documentBatchUploadComplete: "/tenants/onboarding/documents/upload-complete-batch",
		documentsSubmit: "/tenants/onboarding/documents/submit",
		documentStatus: "/tenants/onboarding/documents/status",
	},
} satisfies Record<string, RouteTree>;

/** Path templates composed into `apiRoutes.adminTenants`. */
export const adminTenantsRoutes = {
	invites: "/admin/tenants/invites",
} satisfies Record<string, RouteTree>;
