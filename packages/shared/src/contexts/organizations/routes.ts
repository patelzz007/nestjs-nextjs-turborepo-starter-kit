// API path templates owned by the `organizations` context. Composed into `apiRoutes`
// (`src/api-routes.ts`) with identical keys and values.

import type { RouteTree } from "../../route-tree";

/** Path templates composed into `apiRoutes.rewardsAdmin`. */
export const rewardsAdminOrganizationRoutes = {
	invites: "/admin/invites",
	merchants: "/admin/merchants",
	organizationDetail: "/admin/merchants/:organizationId",
	organizationKyb: "/admin/merchants/:organizationId/kyb",
	locationRequests: "/admin/location-requests",
	organizationLocationCreate: "/admin/merchants/:organizationId/locations",
	organizationLocationReview: "/admin/merchants/:organizationId/locations/:locationId/review",
	organizationKybDocumentDownload: "/admin/merchants/:organizationId/documents/:documentId/download",
} satisfies Record<string, RouteTree>;

/** Path templates composed into `apiRoutes.organizations`. */
export const organizationsRoutes = {
	membershipsBootstrap: "/orgs/memberships",
	context: "/orgs/:orgSlug/context",
	accessRequests: "/orgs/:orgSlug/access-requests",
	reviewAccessRequest: "/orgs/:orgSlug/access-requests/:requestId/review",
	inviteMember: "/orgs/:orgSlug/members/invite",
	listMembers: "/orgs/:orgSlug/members",
	ownMembership: "/orgs/:orgSlug/members/me",
	listMemberInvites: "/orgs/:orgSlug/members/invites",
	revokeMemberInvite: "/orgs/:orgSlug/members/invites/:inviteId/revoke",
	removeMemberFromStore: "/orgs/:orgSlug/members/:membershipId/stores/:locationId/remove",
	teamInvites: {
		validate: "/orgs/invites/validate",
		accept: "/orgs/invites/accept",
		registerAndAccept: "/orgs/invites/register-and-accept",
	},
	kyb: "/orgs/:orgSlug/kyb",
	kybDocumentDownload: "/orgs/:orgSlug/kyb/documents/:documentId/download",
	locations: {
		create: "/orgs/:orgSlug/locations",
		update: "/orgs/:orgSlug/locations/:locationId",
		close: "/orgs/:orgSlug/locations/:locationId/close",
	},
	onboarding: {
		validate: "/orgs/onboarding/validate",
		complete: "/orgs/onboarding/complete",
		documentUploadUrl: "/orgs/onboarding/documents/upload-url",
		documentBatchUploadUrl: "/orgs/onboarding/documents/upload-urls",
		documentUploadComplete: "/orgs/onboarding/documents/upload-complete",
		documentBatchUploadComplete: "/orgs/onboarding/documents/upload-complete-batch",
		documentsSubmit: "/orgs/onboarding/documents/submit",
		documentStatus: "/orgs/onboarding/documents/status",
	},
} satisfies Record<string, RouteTree>;

/** Path templates composed into `apiRoutes.adminOrganizations`. */
export const adminOrganizationsRoutes = {
	invites: "/admin/organizations/invites",
} satisfies Record<string, RouteTree>;
