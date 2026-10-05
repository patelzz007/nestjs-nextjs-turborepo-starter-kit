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

/** Nested route tree — leaves are path strings, branches are named groups. */
export type RouteTree = string | { readonly [key: string]: RouteTree };

// ── The route tree ─────────────────────────────────────────────────────────
// Groups mirror the contract tree (auth / email / geo).

export const apiRoutes = {
	// ── Auth ────────────────────────────────────────────────────────────
	auth: {
		me: "/auth/me",
		/** The signed-in user's own profile — GET reads it, PATCH edits it. */
		profile: "/auth/profile",
		permissions: "/auth/permissions",
		sessionStatus: "/session",
		login: "/auth/login",
		adminLogin: "/auth/login",
		signup: "/auth/signup",
		refresh: "/auth/refresh",
		logout: "/auth/logout",
		forgotPassword: "/auth/forgot-password",
		resetPassword: "/auth/reset-password",
		resendVerification: "/auth/resend-verification",
		verifyEmail: "/auth/verify-email",
		adminUsers: "/auth/admin/users",
		adminUserDetail: "/auth/admin/users/:userId",
		impersonate: "/auth/impersonate/:userId",
		stopImpersonation: "/auth/stop-impersonation",
		changePassword: "/auth/change-password",
		loginTwoFactor: "/auth/login/2fa",
		loginBackupCode: "/auth/login/backup-code",
		verifyLogin: "/auth/verify-login",
		validateResetToken: "/auth/validate-reset-token",
		twoFactorSetup: "/auth/2fa/setup",
		twoFactorEnable: "/auth/2fa/enable",
		twoFactorRotate: "/auth/2fa/rotate",
		twoFactorBackupCodesRemaining: "/auth/2fa/backup-codes/remaining",
		twoFactorVerifyBackupCode: "/auth/2fa/verify-backup-code",
		mfaRecoveryInitiate: "/auth/mfa/recovery",
		mfaRecoveryStatus: "/auth/mfa/recovery/status",
		adminMfaRecoveryReview: "/auth/admin/mfa/recovery/review",
		adminMfaRecoveryRequests: "/auth/admin/mfa/recovery/requests",
	},

	// ── Generic capability catalog ──────────────────────────────────────
	capabilities: {
		catalog: "/capabilities/catalog",
	},

	// ── Email ───────────────────────────────────────────────────────────
	email: {
		previewList: "/notifications/email-preview",
		previewDetail: "/notifications/email-preview/:key",
		previewSend: "/notifications/email-preview/:key/send",
		logList: "/notifications/email-log",
		/** Server-Sent Events stream of email-log changes (`@Sse("events")` on the email-log controller). */
		logEvents: "/notifications/email-log/events",
	},

	// ── Admin RBAC ─────────────────────────────────────────────────────
	admin: {
		roles: {
			list: "/admin/roles",
			userAssign: "/admin/roles/user/assign",
			userRemove: "/admin/roles/user/remove",
			userSync: "/admin/roles/user/sync",
		},
		permissions: {
			list: "/admin/permissions",
			check: "/admin/permissions/check",
			userGrant: "/admin/permissions/user/grant",
			userRevoke: "/admin/permissions/user/revoke",
			userSync: "/admin/permissions/user/sync",
		},
	},

	// ── Geo ────────────────────────────────────────────────────────────
	geo: {
		stats: "/geo/stats",
		autocomplete: "/geo/autocomplete",
		import: "/geo/import",
		importValidate: "/geo/import/validate",
		export: "/geo/export",
		cascadePreview: "/geo/cascade-preview",
		regions: "/geo/regions",
		regionDetail: "/geo/regions/:id",
		subregions: "/geo/subregions",
		subregionDetail: "/geo/subregions/:id",
		countries: "/geo/countries",
		countryDetail: "/geo/countries/:id",
		states: "/geo/states",
		stateDetail: "/geo/states/:id",
		cities: "/geo/cities",
		cityDetail: "/geo/cities/:id",
	},

	// ── Rewards platform (Phase 1) ─────────────────────────────────────
	rewards: {
		list: "/rewards",
		detail: "/rewards/:rewardId",
	},
	legal: {
		accept: "/legal/accept",
		status: "/legal/status",
	},
	claims: {
		otp: "/claims/otp",
		create: "/claims",
		list: "/claims",
		analytics: "/claims/analytics",
		/** The customer's analytics dashboard (custom range + interval). */
		analyticsDashboard: "/claims/analytics/dashboard",
		qr: "/claims/:claimId/qr",
	},
	rewardNotifications: {
		list: "/reward-notifications",
		read: "/reward-notifications/read",
	},
	pos: {
		pairTerminal: "/pos/terminals/pair",
	},
	redemptions: {
		validate: "/redemptions/validate",
		checkout: "/redemptions/checkout",
	},
	files: {
		uploadUrl: "/files/upload-url",
		complete: "/files/:fileId/complete",
		detail: "/files/:fileId",
		downloadUrl: "/files/:fileId/download-url",
		delete: "/files/:fileId",
		processingCallback: "/files/processing-callback",
	},
	organizations: {
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
		memberships: "/orgs/:orgSlug/memberships",
		kyb: "/orgs/:orgSlug/kyb",
		kybDocumentDownload: "/orgs/:orgSlug/kyb/documents/:documentId/download",
		rewards: {
			list: "/orgs/:orgSlug/rewards",
			create: "/orgs/:orgSlug/rewards",
			get: "/orgs/:orgSlug/rewards/:rewardId",
			update: "/orgs/:orgSlug/rewards/:rewardId",
			publish: "/orgs/:orgSlug/rewards/:rewardId/publish",
		},
		terminals: {
			list: "/orgs/:orgSlug/terminals",
			create: "/orgs/:orgSlug/terminals",
			summary: "/orgs/:orgSlug/terminals/summary",
			get: "/orgs/:orgSlug/terminals/:id",
			pairingCode: "/orgs/:orgSlug/terminals/:id/pairing-code",
			remove: "/orgs/:orgSlug/terminals/:id",
			settings: "/orgs/:orgSlug/terminals/settings",
		},
		apiKeys: {
			list: "/orgs/:orgSlug/api-keys",
			create: "/orgs/:orgSlug/api-keys",
			revoke: "/orgs/:orgSlug/api-keys/:keyId/revoke",
		},
		redemptions: "/orgs/:orgSlug/redemptions",
		analytics: "/orgs/:orgSlug/analytics",
		/** The merchant analytics dashboard (custom range + interval, breakdowns). */
		analyticsDashboard: "/orgs/:orgSlug/analytics/dashboard",
		/** The merchant analytics report as a CSV / XLSX / PDF file. */
		analyticsExport: "/orgs/:orgSlug/analytics/export",
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
	},
	adminOrganizations: {
		invites: "/admin/organizations/invites",
	},
	supportAccess: {
		request: "/support-access/request",
		approve: "/support-access/:grantId/approve",
		revoke: "/support-access/:grantId/revoke",
	},
	rewardsAdmin: {
		invites: "/admin/invites",
		invitesPreviewEmail: "/admin/invites/preview-email",
		rewardsPending: "/admin/rewards/pending",
		merchants: "/admin/merchants",
		organizationDetail: "/admin/merchants/:organizationId",
		rewardApprove: "/admin/rewards/:rewardId/approve",
		rewardReject: "/admin/rewards/:rewardId/reject",
		organizationKyb: "/admin/merchants/:organizationId/kyb",
		locationRequests: "/admin/location-requests",
		organizationLocationCreate: "/admin/merchants/:organizationId/locations",
		organizationLocationReview: "/admin/merchants/:organizationId/locations/:locationId/review",
		organizationKybDocumentDownload: "/admin/merchants/:organizationId/documents/:documentId/download",
		salesAnalytics: "/admin/analytics/sales",
		/** The platform analytics dashboard (custom range + interval, breakdowns). */
		analyticsDashboard: "/admin/analytics/dashboard",
		/** The platform analytics report as a CSV / XLSX / PDF file. */
		analyticsExport: "/admin/analytics/export",
	},
	sampleCategory: {
		list: "/sample-category",
		detail: "/sample-category/:id",
		create: "/sample-category",
		bulkCreate: "/sample-category/bulk",
		bulkDelete: "/sample-category/bulk-delete",
		update: "/sample-category/:id",
		delete: "/sample-category/:id",
		restore: "/sample-category/:id/restore",
	},
	product: {
		list: "/product",
		detail: "/product/:id",
		create: "/product",
		bulkCreate: "/product/bulk",
		bulkDelete: "/product/bulk-delete",
		update: "/product/:id",
		delete: "/product/:id",
		restore: "/product/:id/restore",
	},
} satisfies Record<string, RouteTree>;

/** The full route tree — exported for type-level access. */
export type ApiRoutes = typeof apiRoutes;
