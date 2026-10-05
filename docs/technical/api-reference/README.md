---
title: "API reference"
description: "Every endpoint of the API (216 operations), generated from the OpenAPI export with real seed-data samples."
order: 1
author: "Generated from the OpenAPI export"
lastUpdated: 1791158400000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm docs:api -->

# API reference

Every endpoint of `apps/api` — 216 operations, 214 with a sample captured from a freshly seeded API (`pnpm db:seed (development scenario)`). Read [API conventions](../api/README.md) first: the response envelope, authentication, the `X-Client-Type` and `X-Mutation-Intent` headers, errors and list queries apply to every endpoint below.

> [!NOTE]
> This folder is generated. Edit the controllers / zod contracts (or the capture script), then run `pnpm docs:api` — see [how the reference is generated](../api/README.md#how-the-reference-is-generated).

## Pages

| Page | Endpoints | Covers |
| --- | --- | --- |
| [Auth, sessions and account security](./auth-and-sessions.md) | 37 | Login, signup, email verification, password reset, two-factor authentication, MFA recovery, sessions, impersonation and support access. |
| [Roles, permissions, policies and audit](./access-control.md) | 31 | Platform RBAC administration, authorization decisions, Cedar policy drafts, the capability catalog and the HTTP audit log. |
| [Platform administration (merchants, rewards review, analytics)](./platform-admin.md) | 15 | What platform admins do in the admin panel: invite merchants, review KYB and store requests, approve rewards, read platform sales. |
| [Merchant organizations (portal API)](./merchant-organizations.md) | 49 | Everything the merchant portal calls under /orgs/{orgSlug}: onboarding, KYB, stores, team, rewards, POS terminals, API keys, redemptions and analytics. |
| [Customer rewards and claims](./customer-rewards.md) | 12 | The consumer app's API: browse rewards, accept the legal terms, claim with a one-time code, show the QR code, read notifications and spending analytics. |
| [Point of sale (machine-to-machine)](./pos.md) | 3 | Terminal pairing, validating a customer's QR / backup code and recording the paid bill. Authenticated with a merchant API key. |
| [Files and object storage](./files.md) | 9 | Direct-to-storage uploads (upload ticket → upload → complete), signed downloads, deletion and the scanner callback. |
| [Email log, templates and delivery webhooks](./email.md) | 7 | The outbound email log, template previews and test sends, and the Resend delivery webhook. |
| [Geography reference data](./geography.md) | 31 | Regions, subregions, countries, states and cities: CRUD, autocomplete, import and export. |
| [Sample catalog (products and categories)](./catalog-samples.md) | 16 | The reference CRUD modules every new feature copies: list/detail/create/update/soft delete/restore/bulk. |
| [System: health and version](./system.md) | 6 | Liveness, readiness and deep health probes and the API version manifest. |

## All endpoints

| Method | Path | Summary |
| --- | --- | --- |
| GET | [`/api/v1/auth/2fa/backup-codes/remaining`](./auth-and-sessions.md#get-apiv1auth2fabackup-codesremaining) | Count unused backup codes for the authenticated user |
| POST | [`/api/v1/auth/2fa/enable`](./auth-and-sessions.md#post-apiv1auth2faenable) | Confirm 2FA enrollment with a TOTP code |
| POST | [`/api/v1/auth/2fa/rotate`](./auth-and-sessions.md#post-apiv1auth2farotate) | Rotate 2FA after confirming password and current TOTP or backup code |
| POST | [`/api/v1/auth/2fa/setup`](./auth-and-sessions.md#post-apiv1auth2fasetup) | Start 2FA enrollment: generate a pending TOTP secret, QR code and backup codes |
| POST | [`/api/v1/auth/2fa/verify-backup-code`](./auth-and-sessions.md#post-apiv1auth2faverify-backup-code) | Verify a backup code while authenticated |
| GET | [`/api/v1/auth/admin/mfa/recovery/requests`](./auth-and-sessions.md#get-apiv1authadminmfarecoveryrequests) | SuperAdmin: list MFA recovery requests |
| POST | [`/api/v1/auth/admin/mfa/recovery/review`](./auth-and-sessions.md#post-apiv1authadminmfarecoveryreview) | SuperAdmin: approve or deny an MFA recovery request |
| GET | [`/api/v1/auth/admin/users`](./auth-and-sessions.md#get-apiv1authadminusers) | SuperAdmin: list all users with roles and lockout status |
| GET | [`/api/v1/auth/admin/users/{userId}`](./auth-and-sessions.md#get-apiv1authadminusersuserid) | SuperAdmin: get detailed user info including security state |
| PATCH | [`/api/v1/auth/admin/users/{userId}/unlock`](./auth-and-sessions.md#patch-apiv1authadminusersuseridunlock) | SuperAdmin: unlock a locked user account |
| POST | [`/api/v1/auth/change-password`](./auth-and-sessions.md#post-apiv1authchange-password) | Change password for the authenticated user |
| POST | [`/api/v1/auth/forgot-password`](./auth-and-sessions.md#post-apiv1authforgot-password) | Request a password reset email |
| POST | [`/api/v1/auth/impersonate/{userId}`](./auth-and-sessions.md#post-apiv1authimpersonateuserid) | SuperAdmin: impersonate another user |
| POST | [`/api/v1/auth/login`](./auth-and-sessions.md#post-apiv1authlogin) | Authenticate with email and password |
| POST | [`/api/v1/auth/login/2fa`](./auth-and-sessions.md#post-apiv1authlogin2fa) | Complete login with a TOTP code |
| POST | [`/api/v1/auth/login/backup-code`](./auth-and-sessions.md#post-apiv1authloginbackup-code) | Complete login with a one-time backup code |
| POST | [`/api/v1/auth/logout`](./auth-and-sessions.md#post-apiv1authlogout) | Logout from the current device (idempotent — always clears the auth cookies) |
| POST | [`/api/v1/auth/logout-all`](./auth-and-sessions.md#post-apiv1authlogout-all) | Logout from all devices |
| GET | [`/api/v1/auth/me`](./auth-and-sessions.md#get-apiv1authme) | Get the currently authenticated user's profile |
| POST | [`/api/v1/auth/mfa/recovery`](./auth-and-sessions.md#post-apiv1authmfarecovery) | Initiate an admin-reviewed MFA recovery request |
| GET | [`/api/v1/auth/mfa/recovery/status`](./auth-and-sessions.md#get-apiv1authmfarecoverystatus) | Get the current MFA recovery request status |
| GET | [`/api/v1/auth/permissions`](./auth-and-sessions.md#get-apiv1authpermissions) | Get the current session's roles and permissions |
| GET | [`/api/v1/auth/profile`](./auth-and-sessions.md#get-apiv1authprofile) | Get the signed-in user's own profile (name, avatar, optimistic-lock version) |
| PATCH | [`/api/v1/auth/profile`](./auth-and-sessions.md#patch-apiv1authprofile) | Edit the signed-in user's own profile |
| POST | [`/api/v1/auth/refresh`](./auth-and-sessions.md#post-apiv1authrefresh) | Refresh access token using refresh token cookie |
| POST | [`/api/v1/auth/resend-verification`](./auth-and-sessions.md#post-apiv1authresend-verification) | Resend email verification link |
| POST | [`/api/v1/auth/reset-password`](./auth-and-sessions.md#post-apiv1authreset-password) | Reset password using a valid reset token |
| GET | [`/api/v1/auth/sessions`](./auth-and-sessions.md#get-apiv1authsessions) | Get all active sessions for the current user |
| POST | [`/api/v1/auth/signup`](./auth-and-sessions.md#post-apiv1authsignup) | Register a new user account |
| POST | [`/api/v1/auth/stop-impersonation`](./auth-and-sessions.md#post-apiv1authstop-impersonation) | Stop impersonating and restore the original admin session |
| POST | [`/api/v1/auth/validate-reset-token`](./auth-and-sessions.md#post-apiv1authvalidate-reset-token) | Validate a password reset token without consuming it |
| POST | [`/api/v1/auth/verify-email`](./auth-and-sessions.md#post-apiv1authverify-email) | Verify email address using a verification token |
| POST | [`/api/v1/auth/verify-login`](./auth-and-sessions.md#post-apiv1authverify-login) | Complete login with an email verification code |
| GET | [`/api/v1/session`](./auth-and-sessions.md#get-apiv1session) | Current session status (requires a valid access token) |
| POST | [`/api/v1/support-access/{grantId}/approve`](./auth-and-sessions.md#post-apiv1support-accessgrantidapprove) |  |
| POST | [`/api/v1/support-access/{grantId}/revoke`](./auth-and-sessions.md#post-apiv1support-accessgrantidrevoke) |  |
| POST | [`/api/v1/support-access/request`](./auth-and-sessions.md#post-apiv1support-accessrequest) |  |
| GET | [`/api/v1/admin/audit`](./access-control.md#get-apiv1adminaudit) |  |
| GET | [`/api/v1/admin/permissions`](./access-control.md#get-apiv1adminpermissions) |  |
| POST | [`/api/v1/admin/permissions`](./access-control.md#post-apiv1adminpermissions) |  |
| GET | [`/api/v1/admin/permissions/{id}`](./access-control.md#get-apiv1adminpermissionsid) |  |
| PATCH | [`/api/v1/admin/permissions/{id}`](./access-control.md#patch-apiv1adminpermissionsid) |  |
| DELETE | [`/api/v1/admin/permissions/{id}`](./access-control.md#delete-apiv1adminpermissionsid) |  |
| POST | [`/api/v1/admin/permissions/{id}/restore`](./access-control.md#post-apiv1adminpermissionsidrestore) |  |
| POST | [`/api/v1/admin/permissions/check`](./access-control.md#post-apiv1adminpermissionscheck) |  |
| GET | [`/api/v1/admin/permissions/groups/list`](./access-control.md#get-apiv1adminpermissionsgroupslist) |  |
| POST | [`/api/v1/admin/permissions/user/grant`](./access-control.md#post-apiv1adminpermissionsusergrant) |  |
| POST | [`/api/v1/admin/permissions/user/revoke`](./access-control.md#post-apiv1adminpermissionsuserrevoke) |  |
| POST | [`/api/v1/admin/permissions/user/sync`](./access-control.md#post-apiv1adminpermissionsusersync) |  |
| GET | [`/api/v1/admin/roles`](./access-control.md#get-apiv1adminroles) |  |
| POST | [`/api/v1/admin/roles`](./access-control.md#post-apiv1adminroles) |  |
| GET | [`/api/v1/admin/roles/{id}`](./access-control.md#get-apiv1adminrolesid) |  |
| PATCH | [`/api/v1/admin/roles/{id}`](./access-control.md#patch-apiv1adminrolesid) |  |
| DELETE | [`/api/v1/admin/roles/{id}`](./access-control.md#delete-apiv1adminrolesid) |  |
| PATCH | [`/api/v1/admin/roles/{id}/parent`](./access-control.md#patch-apiv1adminrolesidparent) |  |
| POST | [`/api/v1/admin/roles/{id}/permissions`](./access-control.md#post-apiv1adminrolesidpermissions) |  |
| POST | [`/api/v1/admin/roles/{id}/restore`](./access-control.md#post-apiv1adminrolesidrestore) |  |
| POST | [`/api/v1/admin/roles/{id}/validate-assignment`](./access-control.md#post-apiv1adminrolesidvalidate-assignment) |  |
| POST | [`/api/v1/admin/roles/preview`](./access-control.md#post-apiv1adminrolespreview) |  |
| POST | [`/api/v1/admin/roles/user/assign`](./access-control.md#post-apiv1adminrolesuserassign) |  |
| POST | [`/api/v1/admin/roles/user/remove`](./access-control.md#post-apiv1adminrolesuserremove) |  |
| POST | [`/api/v1/admin/roles/user/sync`](./access-control.md#post-apiv1adminrolesusersync) |  |
| POST | [`/api/v1/authorization/decisions`](./access-control.md#post-apiv1authorizationdecisions) | Evaluate capability checks for the current user (UI hints — the API re-authorizes every operation) |
| GET | [`/api/v1/authorization/decisions/explain`](./access-control.md#get-apiv1authorizationdecisionsexplain) | Admin: step-by-step explanation of an authorization decision |
| GET | [`/api/v1/capabilities/catalog`](./access-control.md#get-apiv1capabilitiescatalog) | List capability catalog entries (optionally filtered by scope) |
| POST | [`/api/v1/policies/drafts`](./access-control.md#post-apiv1policiesdrafts) |  |
| POST | [`/api/v1/policies/drafts/{draftId}/simulate`](./access-control.md#post-apiv1policiesdraftsdraftidsimulate) |  |
| POST | [`/api/v1/policies/publish`](./access-control.md#post-apiv1policiespublish) |  |
| GET | [`/api/v1/admin/analytics/dashboard`](./platform-admin.md#get-apiv1adminanalyticsdashboard) | Platform analytics dashboard: custom range + interval, compared totals, series, top merchants, categories, cities, new vs returning customers |
| GET | [`/api/v1/admin/analytics/export`](./platform-admin.md#get-apiv1adminanalyticsexport) | Download the platform analytics report (csv \| xlsx \| pdf) for a date range |
| GET | [`/api/v1/admin/analytics/sales`](./platform-admin.md#get-apiv1adminanalyticssales) | Platform-wide sales: paid POS bills, compared with the previous period, plus top merchants |
| POST | [`/api/v1/admin/invites`](./platform-admin.md#post-apiv1admininvites) | Create merchant invite |
| POST | [`/api/v1/admin/invites/preview-email`](./platform-admin.md#post-apiv1admininvitespreview-email) | Preview merchant invite email with form data (does not send) |
| GET | [`/api/v1/admin/location-requests`](./platform-admin.md#get-apiv1adminlocation-requests) | List pending organization store location requests |
| GET | [`/api/v1/admin/merchants`](./platform-admin.md#get-apiv1adminmerchants) | List merchant organizations |
| GET | [`/api/v1/admin/merchants/{organizationId}`](./platform-admin.md#get-apiv1adminmerchantsorganizationid) | Get merchant organization detail for KYB review |
| GET | [`/api/v1/admin/merchants/{organizationId}/documents/{documentId}/download`](./platform-admin.md#get-apiv1adminmerchantsorganizationiddocumentsdocumentiddownload) | Get a short-lived signed download URL for a merchant KYB document |
| PATCH | [`/api/v1/admin/merchants/{organizationId}/kyb`](./platform-admin.md#patch-apiv1adminmerchantsorganizationidkyb) | Update merchant KYB status (REJECTED / ACTION_REQUIRED require kybFields.rejectionReason) |
| POST | [`/api/v1/admin/merchants/{organizationId}/locations`](./platform-admin.md#post-apiv1adminmerchantsorganizationidlocations) | Create an organization store location |
| PATCH | [`/api/v1/admin/merchants/{organizationId}/locations/{locationId}/review`](./platform-admin.md#patch-apiv1adminmerchantsorganizationidlocationslocationidreview) | Approve or reject an organization store location request |
| POST | [`/api/v1/admin/rewards/{rewardId}/approve`](./platform-admin.md#post-apiv1adminrewardsrewardidapprove) | Approve a pending reward (no body required) |
| POST | [`/api/v1/admin/rewards/{rewardId}/reject`](./platform-admin.md#post-apiv1adminrewardsrewardidreject) | Reject a pending reward |
| GET | [`/api/v1/admin/rewards/pending`](./platform-admin.md#get-apiv1adminrewardspending) | List rewards pending moderation (oldest first, paginated) |
| POST | [`/api/v1/admin/organizations/invites`](./merchant-organizations.md#post-apiv1adminorganizationsinvites) |  |
| POST | [`/api/v1/orgs/{orgSlug}/access-requests`](./merchant-organizations.md#post-apiv1orgsorgslugaccess-requests) |  |
| POST | [`/api/v1/orgs/{orgSlug}/access-requests/{requestId}/review`](./merchant-organizations.md#post-apiv1orgsorgslugaccess-requestsrequestidreview) |  |
| GET | [`/api/v1/orgs/{orgSlug}/analytics`](./merchant-organizations.md#get-apiv1orgsorgsluganalytics) | Organization reward performance analytics |
| GET | [`/api/v1/orgs/{orgSlug}/analytics/dashboard`](./merchant-organizations.md#get-apiv1orgsorgsluganalyticsdashboard) | Merchant analytics dashboard: custom range + interval, compared totals, series, store / reward / redemption-method breakdowns |
| GET | [`/api/v1/orgs/{orgSlug}/analytics/export`](./merchant-organizations.md#get-apiv1orgsorgsluganalyticsexport) | Download the merchant analytics report (csv \| xlsx \| pdf) for a date range |
| GET | [`/api/v1/orgs/{orgSlug}/api-keys`](./merchant-organizations.md#get-apiv1orgsorgslugapi-keys) | List organization API keys |
| POST | [`/api/v1/orgs/{orgSlug}/api-keys`](./merchant-organizations.md#post-apiv1orgsorgslugapi-keys) | Create a POS API key |
| POST | [`/api/v1/orgs/{orgSlug}/api-keys/{keyId}/revoke`](./merchant-organizations.md#post-apiv1orgsorgslugapi-keyskeyidrevoke) | Revoke a POS API key (no body required) |
| GET | [`/api/v1/orgs/{orgSlug}/context`](./merchant-organizations.md#get-apiv1orgsorgslugcontext) |  |
| GET | [`/api/v1/orgs/{orgSlug}/kyb`](./merchant-organizations.md#get-apiv1orgsorgslugkyb) | Get the organization KYB profile (owner only) |
| PATCH | [`/api/v1/orgs/{orgSlug}/kyb`](./merchant-organizations.md#patch-apiv1orgsorgslugkyb) | Submit or resubmit business verification details (owner only) |
| GET | [`/api/v1/orgs/{orgSlug}/kyb/documents/{documentId}/download`](./merchant-organizations.md#get-apiv1orgsorgslugkybdocumentsdocumentiddownload) | Get a short-lived signed download URL for a CLEAN KYB document (owner only) |
| POST | [`/api/v1/orgs/{orgSlug}/locations`](./merchant-organizations.md#post-apiv1orgsorgsluglocations) |  |
| PATCH | [`/api/v1/orgs/{orgSlug}/locations/{locationId}`](./merchant-organizations.md#patch-apiv1orgsorgsluglocationslocationid) |  |
| POST | [`/api/v1/orgs/{orgSlug}/locations/{locationId}/close`](./merchant-organizations.md#post-apiv1orgsorgsluglocationslocationidclose) |  |
| GET | [`/api/v1/orgs/{orgSlug}/members`](./merchant-organizations.md#get-apiv1orgsorgslugmembers) |  |
| POST | [`/api/v1/orgs/{orgSlug}/members/{membershipId}/stores/{locationId}/remove`](./merchant-organizations.md#post-apiv1orgsorgslugmembersmembershipidstoreslocationidremove) |  |
| POST | [`/api/v1/orgs/{orgSlug}/members/invite`](./merchant-organizations.md#post-apiv1orgsorgslugmembersinvite) |  |
| GET | [`/api/v1/orgs/{orgSlug}/members/invites`](./merchant-organizations.md#get-apiv1orgsorgslugmembersinvites) |  |
| POST | [`/api/v1/orgs/{orgSlug}/members/invites/{inviteId}/revoke`](./merchant-organizations.md#post-apiv1orgsorgslugmembersinvitesinviteidrevoke) |  |
| PATCH | [`/api/v1/orgs/{orgSlug}/members/me`](./merchant-organizations.md#patch-apiv1orgsorgslugmembersme) |  |
| GET | [`/api/v1/orgs/{orgSlug}/memberships`](./merchant-organizations.md#get-apiv1orgsorgslugmemberships) | List organization memberships for the current user |
| GET | [`/api/v1/orgs/{orgSlug}/redemptions`](./merchant-organizations.md#get-apiv1orgsorgslugredemptions) | List organization redemptions |
| GET | [`/api/v1/orgs/{orgSlug}/rewards`](./merchant-organizations.md#get-apiv1orgsorgslugrewards) | List organization rewards |
| POST | [`/api/v1/orgs/{orgSlug}/rewards`](./merchant-organizations.md#post-apiv1orgsorgslugrewards) | Create a draft reward |
| GET | [`/api/v1/orgs/{orgSlug}/rewards/{rewardId}`](./merchant-organizations.md#get-apiv1orgsorgslugrewardsrewardid) | Read one organization reward (404 when not offered at any of the caller's stores) |
| PATCH | [`/api/v1/orgs/{orgSlug}/rewards/{rewardId}`](./merchant-organizations.md#patch-apiv1orgsorgslugrewardsrewardid) | Update a draft or pending reward |
| POST | [`/api/v1/orgs/{orgSlug}/rewards/{rewardId}/publish`](./merchant-organizations.md#post-apiv1orgsorgslugrewardsrewardidpublish) | Submit reward for moderation review (no body required) |
| GET | [`/api/v1/orgs/{orgSlug}/terminals`](./merchant-organizations.md#get-apiv1orgsorgslugterminals) | List the organization's POS terminals |
| POST | [`/api/v1/orgs/{orgSlug}/terminals`](./merchant-organizations.md#post-apiv1orgsorgslugterminals) | Register a POS terminal at a store and get its one-time pairing code |
| GET | [`/api/v1/orgs/{orgSlug}/terminals/{id}`](./merchant-organizations.md#get-apiv1orgsorgslugterminalsid) | Read one POS terminal (404 outside the caller's stores) |
| DELETE | [`/api/v1/orgs/{orgSlug}/terminals/{id}`](./merchant-organizations.md#delete-apiv1orgsorgslugterminalsid) | Remove a POS terminal and revoke its API key |
| POST | [`/api/v1/orgs/{orgSlug}/terminals/{id}/pairing-code`](./merchant-organizations.md#post-apiv1orgsorgslugterminalsidpairing-code) | Issue a new pairing code (first pairing, expired code, or re-pair — the old key stops working once the new code is used) |
| GET | [`/api/v1/orgs/{orgSlug}/terminals/settings`](./merchant-organizations.md#get-apiv1orgsorgslugterminalssettings) | Read the organization's POS terminal policy |
| PATCH | [`/api/v1/orgs/{orgSlug}/terminals/settings`](./merchant-organizations.md#patch-apiv1orgsorgslugterminalssettings) | Turn 'only allow registered terminals' on or off |
| GET | [`/api/v1/orgs/{orgSlug}/terminals/summary`](./merchant-organizations.md#get-apiv1orgsorgslugterminalssummary) | Count the organization's live POS terminals per status, within the caller's stores |
| POST | [`/api/v1/orgs/invites/accept`](./merchant-organizations.md#post-apiv1orgsinvitesaccept) |  |
| POST | [`/api/v1/orgs/invites/register-and-accept`](./merchant-organizations.md#post-apiv1orgsinvitesregister-and-accept) |  |
| POST | [`/api/v1/orgs/invites/validate`](./merchant-organizations.md#post-apiv1orgsinvitesvalidate) |  |
| GET | [`/api/v1/orgs/memberships`](./merchant-organizations.md#get-apiv1orgsmemberships) | List RewardHub organization memberships for the current user |
| POST | [`/api/v1/orgs/onboarding/complete`](./merchant-organizations.md#post-apiv1orgsonboardingcomplete) | Complete merchant onboarding — links OWNER membership and platform User role |
| POST | [`/api/v1/orgs/onboarding/documents/status`](./merchant-organizations.md#post-apiv1orgsonboardingdocumentsstatus) | Scan status of this onboarding's KYB uploads (same document window as the upload endpoints) |
| POST | [`/api/v1/orgs/onboarding/documents/submit`](./merchant-organizations.md#post-apiv1orgsonboardingdocumentssubmit) | Attach onboarding KYB documents and submit the merchant for admin review |
| POST | [`/api/v1/orgs/onboarding/documents/upload-complete`](./merchant-organizations.md#post-apiv1orgsonboardingdocumentsupload-complete) | Complete an invite-authorized KYB document upload |
| POST | [`/api/v1/orgs/onboarding/documents/upload-complete-batch`](./merchant-organizations.md#post-apiv1orgsonboardingdocumentsupload-complete-batch) | Complete invite-authorized KYB document uploads in one request |
| POST | [`/api/v1/orgs/onboarding/documents/upload-url`](./merchant-organizations.md#post-apiv1orgsonboardingdocumentsupload-url) | Create an invite-authorized KYB document upload ticket |
| POST | [`/api/v1/orgs/onboarding/documents/upload-urls`](./merchant-organizations.md#post-apiv1orgsonboardingdocumentsupload-urls) | Create invite-authorized KYB document upload tickets in one request |
| POST | [`/api/v1/orgs/onboarding/validate`](./merchant-organizations.md#post-apiv1orgsonboardingvalidate) | Validate a merchant onboarding invite token |
| GET | [`/api/v1/claims`](./customer-rewards.md#get-apiv1claims) | List my reward claims |
| POST | [`/api/v1/claims`](./customer-rewards.md#post-apiv1claims) | Claim a reward after OTP verification |
| GET | [`/api/v1/claims/{claimId}/qr`](./customer-rewards.md#get-apiv1claimsclaimidqr) | Refresh QR payload for an active claim |
| GET | [`/api/v1/claims/analytics`](./customer-rewards.md#get-apiv1claimsanalytics) | Reward activity analytics for the signed-in user |
| GET | [`/api/v1/claims/analytics/dashboard`](./customer-rewards.md#get-apiv1claimsanalyticsdashboard) | My analytics dashboard: custom range + interval, compared totals, series, spending by category / merchant over time |
| POST | [`/api/v1/claims/otp`](./customer-rewards.md#post-apiv1claimsotp) | Request claim OTP (emailed to your account — no SMS in dev) |
| POST | [`/api/v1/legal/accept`](./customer-rewards.md#post-apiv1legalaccept) | Accept rewards terms and privacy policy |
| GET | [`/api/v1/legal/status`](./customer-rewards.md#get-apiv1legalstatus) | Get rewards legal acceptance and verified phone status |
| GET | [`/api/v1/reward-notifications`](./customer-rewards.md#get-apiv1reward-notifications) | List in-app reward notifications |
| POST | [`/api/v1/reward-notifications/read`](./customer-rewards.md#post-apiv1reward-notificationsread) | Mark reward notifications as read |
| GET | [`/api/v1/rewards`](./customer-rewards.md#get-apiv1rewards) | Browse published consumer rewards |
| GET | [`/api/v1/rewards/{rewardId}`](./customer-rewards.md#get-apiv1rewardsrewardid) | Get published reward detail |
| POST | [`/api/v1/pos/terminals/pair`](./pos.md#post-apiv1posterminalspair) | Pair a POS terminal with the one-time code from the merchant console |
| POST | [`/api/v1/redemptions/checkout`](./pos.md#post-apiv1redemptionscheckout) | POS checkout: after payment, record the bill and redeem every presented reward (all-or-nothing, idempotent) |
| POST | [`/api/v1/redemptions/validate`](./pos.md#post-apiv1redemptionsvalidate) | POS validate QR or backup code |
| GET | [`/api/v1/files/{fileId}`](./files.md#get-apiv1filesfileid) | Get file metadata |
| DELETE | [`/api/v1/files/{fileId}`](./files.md#delete-apiv1filesfileid) | Soft-delete a file and queue physical deletion |
| POST | [`/api/v1/files/{fileId}/complete`](./files.md#post-apiv1filesfileidcomplete) | Complete a direct upload after browser upload |
| GET | [`/api/v1/files/{fileId}/download-url`](./files.md#get-apiv1filesfileiddownload-url) | Get a short-lived download URL for a private file |
| GET | [`/api/v1/files/{fileId}/local-public`](./files.md#get-apiv1filesfileidlocal-public) | Serve a READY public asset from local storage (development only) |
| POST | [`/api/v1/files/{fileId}/local-upload`](./files.md#post-apiv1filesfileidlocal-upload) | Receive a browser multipart upload for a signed local-storage ticket (development only) |
| GET | [`/api/v1/files/local-download`](./files.md#get-apiv1fileslocal-download) | Download a private object through a signed, expiring local-storage link (development only) |
| POST | [`/api/v1/files/processing-callback`](./files.md#post-apiv1filesprocessing-callback) | External processing callback for file lifecycle updates |
| POST | [`/api/v1/files/upload-url`](./files.md#post-apiv1filesupload-url) | Create a browser upload ticket |
| GET | [`/api/v1/notifications/email-log`](./email.md#get-apiv1notificationsemail-log) | List sent emails |
| GET | [`/api/v1/notifications/email-log/events`](./email.md#get-apiv1notificationsemail-logevents) | Live EmailLog update stream (SSE) |
| GET | [`/api/v1/notifications/email-preview`](./email.md#get-apiv1notificationsemail-preview) | List email template metadata |
| GET | [`/api/v1/notifications/email-preview/{key}`](./email.md#get-apiv1notificationsemail-previewkey) | Render one email template preview |
| POST | [`/api/v1/notifications/email-preview/{key}/send`](./email.md#post-apiv1notificationsemail-previewkeysend) | Send one email template (sample props) |
| GET | [`/notifications/email-webhook`](./email.md#get-notificationsemail-webhook) | Webhook endpoint info (GET is not the delivery path) |
| POST | [`/notifications/email-webhook`](./email.md#post-notificationsemail-webhook) | Resend delivery webhook (signature-verified) |
| GET | [`/api/v1/geo/autocomplete`](./geography.md#get-apiv1geoautocomplete) | Autocomplete search across all geo entities |
| GET | [`/api/v1/geo/cascade-preview`](./geography.md#get-apiv1geocascade-preview) | Preview cascade delete impact |
| GET | [`/api/v1/geo/cities`](./geography.md#get-apiv1geocities) | List cities |
| POST | [`/api/v1/geo/cities`](./geography.md#post-apiv1geocities) | Create a city |
| GET | [`/api/v1/geo/cities/{id}`](./geography.md#get-apiv1geocitiesid) | Get city by ID |
| PATCH | [`/api/v1/geo/cities/{id}`](./geography.md#patch-apiv1geocitiesid) | Update a city |
| DELETE | [`/api/v1/geo/cities/{id}`](./geography.md#delete-apiv1geocitiesid) | Delete a city |
| GET | [`/api/v1/geo/countries`](./geography.md#get-apiv1geocountries) | List countries |
| POST | [`/api/v1/geo/countries`](./geography.md#post-apiv1geocountries) | Create a country |
| GET | [`/api/v1/geo/countries/{id}`](./geography.md#get-apiv1geocountriesid) | Get country by ID |
| PATCH | [`/api/v1/geo/countries/{id}`](./geography.md#patch-apiv1geocountriesid) | Update a country |
| DELETE | [`/api/v1/geo/countries/{id}`](./geography.md#delete-apiv1geocountriesid) | Delete a country |
| GET | [`/api/v1/geo/export`](./geography.md#get-apiv1geoexport) | Export the cities of the matching countries (rows are always JSON; `format=csv` is not rendered server-side) |
| POST | [`/api/v1/geo/import`](./geography.md#post-apiv1geoimport) | Bulk import geo data |
| POST | [`/api/v1/geo/import/validate`](./geography.md#post-apiv1geoimportvalidate) | Validate geo import data without inserting |
| GET | [`/api/v1/geo/regions`](./geography.md#get-apiv1georegions) | List regions |
| POST | [`/api/v1/geo/regions`](./geography.md#post-apiv1georegions) | Create a region |
| GET | [`/api/v1/geo/regions/{id}`](./geography.md#get-apiv1georegionsid) | Get region by ID |
| PATCH | [`/api/v1/geo/regions/{id}`](./geography.md#patch-apiv1georegionsid) | Update a region |
| DELETE | [`/api/v1/geo/regions/{id}`](./geography.md#delete-apiv1georegionsid) | Delete a region |
| GET | [`/api/v1/geo/states`](./geography.md#get-apiv1geostates) | List states |
| POST | [`/api/v1/geo/states`](./geography.md#post-apiv1geostates) | Create a state |
| GET | [`/api/v1/geo/states/{id}`](./geography.md#get-apiv1geostatesid) | Get state by ID |
| PATCH | [`/api/v1/geo/states/{id}`](./geography.md#patch-apiv1geostatesid) | Update a state |
| DELETE | [`/api/v1/geo/states/{id}`](./geography.md#delete-apiv1geostatesid) | Delete a state |
| GET | [`/api/v1/geo/stats`](./geography.md#get-apiv1geostats) | Get geo entity counts |
| GET | [`/api/v1/geo/subregions`](./geography.md#get-apiv1geosubregions) | List subregions |
| POST | [`/api/v1/geo/subregions`](./geography.md#post-apiv1geosubregions) | Create a subregion |
| GET | [`/api/v1/geo/subregions/{id}`](./geography.md#get-apiv1geosubregionsid) | Get subregion by ID |
| PATCH | [`/api/v1/geo/subregions/{id}`](./geography.md#patch-apiv1geosubregionsid) | Update a subregion |
| DELETE | [`/api/v1/geo/subregions/{id}`](./geography.md#delete-apiv1geosubregionsid) | Delete a subregion |
| GET | [`/api/v1/product`](./catalog-samples.md#get-apiv1product) | List Products |
| POST | [`/api/v1/product`](./catalog-samples.md#post-apiv1product) | Create Product (send an Idempotency-Key header to make retries safe) |
| GET | [`/api/v1/product/{id}`](./catalog-samples.md#get-apiv1productid) | Get Product by id |
| PATCH | [`/api/v1/product/{id}`](./catalog-samples.md#patch-apiv1productid) | Update Product |
| DELETE | [`/api/v1/product/{id}`](./catalog-samples.md#delete-apiv1productid) | Soft delete Product |
| POST | [`/api/v1/product/{id}/restore`](./catalog-samples.md#post-apiv1productidrestore) | Restore Product |
| POST | [`/api/v1/product/bulk`](./catalog-samples.md#post-apiv1productbulk) | Bulk create products |
| POST | [`/api/v1/product/bulk-delete`](./catalog-samples.md#post-apiv1productbulk-delete) | Bulk soft delete products |
| GET | [`/api/v1/sample-category`](./catalog-samples.md#get-apiv1sample-category) | List SampleCategories |
| POST | [`/api/v1/sample-category`](./catalog-samples.md#post-apiv1sample-category) | Create SampleCategory |
| GET | [`/api/v1/sample-category/{id}`](./catalog-samples.md#get-apiv1sample-categoryid) | Get SampleCategory by id |
| PATCH | [`/api/v1/sample-category/{id}`](./catalog-samples.md#patch-apiv1sample-categoryid) | Update SampleCategory |
| DELETE | [`/api/v1/sample-category/{id}`](./catalog-samples.md#delete-apiv1sample-categoryid) | Soft delete SampleCategory |
| POST | [`/api/v1/sample-category/{id}/restore`](./catalog-samples.md#post-apiv1sample-categoryidrestore) | Restore SampleCategory |
| POST | [`/api/v1/sample-category/bulk`](./catalog-samples.md#post-apiv1sample-categorybulk) | Bulk create samplecategories |
| POST | [`/api/v1/sample-category/bulk-delete`](./catalog-samples.md#post-apiv1sample-categorybulk-delete) | Bulk soft delete samplecategories |
| GET | [`/`](./system.md#get) | Welcome message |
| GET | [`/health`](./system.md#get-health) | Health check (includes DB status) — deprecated alias, prefer /health/live and /health/ready |
| GET | [`/health/deep`](./system.md#get-healthdeep) | Deep health check (DB + filesystem + external services) |
| GET | [`/health/live`](./system.md#get-healthlive) | Liveness probe — process is up (never touches the database) |
| GET | [`/health/ready`](./system.md#get-healthready) | Readiness probe — startup finished, database and critical dependencies reachable |
| GET | [`/version`](./system.md#get-version) | API version manifest (current, supported, docs) |
