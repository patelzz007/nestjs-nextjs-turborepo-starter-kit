---
title: "API reference"
description: "Every endpoint of the API (319 operations), generated from the OpenAPI export with real seed-data samples."
order: 1
author: "Generated from the OpenAPI export"
lastUpdated: 1792540800000
coverImage: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&h=630&fit=crop"
tags: ["api", "reference", "generated"]
---

<!-- GENERATED FILE — do not edit. Source: docs/generated/openapi.json + apps/api controller decorators + docs/generated/api-samples.json. Regenerate: pnpm docs:api -->

# API reference

Every endpoint of `apps/api` — 319 operations, 232 with a sample captured from a freshly seeded API (`pnpm db:seed (development scenario)`). Read [API conventions](../api/README.md) first: the response envelope, authentication, the `X-Client-Type` and `X-Mutation-Intent` headers, errors and list queries apply to every endpoint below.

**Content type.** Every endpoint takes and returns `application/json` unless its *Content type* line names another (a file upload, a download, a live stream). Errors are always `application/json`.

> [!NOTE]
> This folder is generated. Edit the controllers / zod contracts (or the capture script), then run `pnpm docs:api` — see [how the reference is generated](../api/README.md#how-the-reference-is-generated).

## Pages

| Page | Endpoints | Covers |
| --- | --- | --- |
| [Auth, sessions and account security](./auth-and-sessions.md) | 47 | Login, signup, email verification, password reset, two-factor authentication, MFA recovery, sessions, impersonation and support access. |
| [Roles, permissions, policies and audit](./access-control.md) | 37 | Platform RBAC administration, authorization decisions, Cedar policy drafts, the capability catalog and the HTTP audit log. |
| [Platform administration (merchants, rewards review, analytics)](./platform-admin.md) | 25 | What platform admins do in the admin panel: invite merchants, review KYB and store requests, approve rewards, read platform sales. |
| [Merchant tenants (portal API)](./merchant-tenants.md) | 56 | Everything the merchant portal calls under /tenants/{tenantSlug}: onboarding, KYB, stores, team, rewards, POS terminals, API keys, redemptions and analytics. |
| [Customer rewards and claims](./customer-rewards.md) | 15 | The consumer app's API: browse rewards, share them with friends, accept the legal terms, claim with a one-time code, show the QR code, read notifications and spending analytics. |
| [Point of sale and integrations (machine-to-machine)](./pos.md) | 13 | Terminal pairing, validating a customer's QR / backup code and recording the paid bill, plus the integration API (`/integration/*`: rewards, analytics, redemption history). Authenticated with a merchant API key, which names its own tenant. |
| [Files and object storage](./files.md) | 11 | Direct-to-storage uploads (upload ticket → upload → complete), signed downloads, deletion and the scanner callback. |
| [Email log, templates and delivery webhooks](./email.md) | 7 | The outbound email log, template previews and test sends, and the Resend delivery webhook. |
| [Geography reference data](./geography.md) | 31 | Regions, subregions, countries, states and cities: CRUD, autocomplete, import and export. |
| [GitHub contributions](./github.md) | 5 | Read-only summary, commit history with line counts and contributor totals of the GitHub repositories the API is configured with. |
| [GitHub pull requests](./github-pull-requests.md) | 25 | Admins link their own fine-grained GitHub token, then list and read pull requests — conversation, commits, files with diffs, line-comment threads and edit histories — as themselves. |
| [Sample catalog (products and categories)](./catalog-samples.md) | 16 | The reference CRUD modules every new feature copies: list/detail/create/update/soft delete/restore/bulk. |
| [Kanban boards](./kanban.md) | 24 | The platform staff's two linked boards: the epic → feature → story → task → subtask hierarchy with item keys, moves under the board lock (optimistic locking), Move to… (a new parent), ranked item search, WIP limits, checklists, links, watchers, history, comments with files, CSV import and attachments. |
| [System: health and version](./system.md) | 7 | Liveness, readiness and deep health probes, the apps' connection-quality ping and the API version manifest. |

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
| POST | [`/api/v1/auth/admin/users/{userId}/ban`](./auth-and-sessions.md#post-apiv1authadminusersuseridban) | SuperAdmin: ban an account — it can no longer sign in, and every session it has is revoked |
| POST | [`/api/v1/auth/admin/users/{userId}/unban`](./auth-and-sessions.md#post-apiv1authadminusersuseridunban) | SuperAdmin: lift an account's ban — it may sign in again |
| PATCH | [`/api/v1/auth/admin/users/{userId}/unlock`](./auth-and-sessions.md#patch-apiv1authadminusersuseridunlock) | SuperAdmin: unlock a locked user account |
| POST | [`/api/v1/auth/change-password`](./auth-and-sessions.md#post-apiv1authchange-password) | Change password for the authenticated user |
| POST | [`/api/v1/auth/forgot-password`](./auth-and-sessions.md#post-apiv1authforgot-password) | Request a password reset email |
| POST | [`/api/v1/auth/impersonate/{userId}`](./auth-and-sessions.md#post-apiv1authimpersonateuserid) | SuperAdmin: impersonate another user |
| POST | [`/api/v1/auth/login`](./auth-and-sessions.md#post-apiv1authlogin) | Authenticate with email and password |
| POST | [`/api/v1/auth/login/2fa`](./auth-and-sessions.md#post-apiv1authlogin2fa) | Complete login with a TOTP code |
| POST | [`/api/v1/auth/login/backup-code`](./auth-and-sessions.md#post-apiv1authloginbackup-code) | Complete login with a one-time backup code |
| POST | [`/api/v1/auth/logout`](./auth-and-sessions.md#post-apiv1authlogout) | Logout from the current device (idempotent — always clears a browser client's auth cookies; client type mobile presents its refresh token as { refreshToken }) |
| POST | [`/api/v1/auth/logout-all`](./auth-and-sessions.md#post-apiv1authlogout-all) | Logout from all devices, on every client type (refresh token: the httpOnly cookie for browser client types, { refreshToken } for client type mobile) |
| GET | [`/api/v1/auth/me`](./auth-and-sessions.md#get-apiv1authme) | Get the currently authenticated user's profile |
| POST | [`/api/v1/auth/mfa/recovery`](./auth-and-sessions.md#post-apiv1authmfarecovery) | Initiate an admin-reviewed MFA recovery request |
| GET | [`/api/v1/auth/mfa/recovery/status`](./auth-and-sessions.md#get-apiv1authmfarecoverystatus) | Get the current MFA recovery request status |
| GET | [`/api/v1/auth/permissions`](./auth-and-sessions.md#get-apiv1authpermissions) | Get the current session's roles and permissions |
| GET | [`/api/v1/auth/preferences`](./auth-and-sessions.md#get-apiv1authpreferences) | The signed-in user's preferences; a key that is absent uses the page's default |
| PUT | [`/api/v1/auth/preferences/{key}`](./auth-and-sessions.md#put-apiv1authpreferenceskey) | Remember one choice |
| DELETE | [`/api/v1/auth/preferences/{key}`](./auth-and-sessions.md#delete-apiv1authpreferenceskey) | Reset one choice to the default (soft delete); answers the preferences left |
| GET | [`/api/v1/auth/profile`](./auth-and-sessions.md#get-apiv1authprofile) | Get the signed-in user's own profile (name, avatar, optimistic-lock version) |
| PATCH | [`/api/v1/auth/profile`](./auth-and-sessions.md#patch-apiv1authprofile) | Edit the signed-in user's own profile |
| POST | [`/api/v1/auth/refresh`](./auth-and-sessions.md#post-apiv1authrefresh) | Rotate the session tokens (refresh token: the httpOnly cookie for browser client types, the { refreshToken } body for client type mobile) |
| POST | [`/api/v1/auth/resend-verification`](./auth-and-sessions.md#post-apiv1authresend-verification) | Resend email verification link |
| POST | [`/api/v1/auth/reset-password`](./auth-and-sessions.md#post-apiv1authreset-password) | Reset password using a valid reset token |
| GET | [`/api/v1/auth/sessions`](./auth-and-sessions.md#get-apiv1authsessions) | List the caller's signed-in devices (every client type), most recently active first; `isCurrent` marks this one |
| POST | [`/api/v1/auth/sessions/{sessionId}/revoke`](./auth-and-sessions.md#post-apiv1authsessionssessionidrevoke) | Sign out one of the caller's devices |
| POST | [`/api/v1/auth/signup`](./auth-and-sessions.md#post-apiv1authsignup) | Register a new user account |
| GET | [`/api/v1/auth/signup-referrals/dashboard`](./auth-and-sessions.md#get-apiv1authsignup-referralsdashboard) | Referrer dashboard: current code and shareability |
| GET | [`/api/v1/auth/signup-referrals/referees`](./auth-and-sessions.md#get-apiv1authsignup-referralsreferees) | People who registered with the caller's referral code |
| POST | [`/api/v1/auth/stop-impersonation`](./auth-and-sessions.md#post-apiv1authstop-impersonation) | Stop impersonating and restore the original admin session |
| POST | [`/api/v1/auth/validate-reset-token`](./auth-and-sessions.md#post-apiv1authvalidate-reset-token) | Validate a password reset token without consuming it |
| POST | [`/api/v1/auth/verify-email`](./auth-and-sessions.md#post-apiv1authverify-email) | Verify email address using a verification token |
| POST | [`/api/v1/auth/verify-login`](./auth-and-sessions.md#post-apiv1authverify-login) | Complete login with an email verification code |
| GET | [`/api/v1/session`](./auth-and-sessions.md#get-apiv1session) | Current session status (requires a valid access token) |
| GET | [`/api/v1/support-access`](./auth-and-sessions.md#get-apiv1support-access) |  |
| POST | [`/api/v1/support-access/{grantId}/approve`](./auth-and-sessions.md#post-apiv1support-accessgrantidapprove) |  |
| POST | [`/api/v1/support-access/{grantId}/revoke`](./auth-and-sessions.md#post-apiv1support-accessgrantidrevoke) |  |
| POST | [`/api/v1/support-access/request`](./auth-and-sessions.md#post-apiv1support-accessrequest) |  |
| GET | [`/api/v1/tenants/{tenantSlug}/support-access`](./auth-and-sessions.md#get-apiv1tenantstenantslugsupport-access) |  |
| GET | [`/api/v1/admin/audit`](./access-control.md#get-apiv1adminaudit) |  |
| GET | [`/api/v1/admin/audit-logs`](./access-control.md#get-apiv1adminaudit-logs) | List audit records (newest first) |
| GET | [`/api/v1/admin/audit-logs/{id}`](./access-control.md#get-apiv1adminaudit-logsid) | Get one complete audit record |
| GET | [`/api/v1/admin/audit-trail`](./access-control.md#get-apiv1adminaudit-trail) | List the audit trail (newest first) |
| GET | [`/api/v1/admin/audit-trail/events`](./access-control.md#get-apiv1adminaudit-trailevents) | Live audit trail update stream (SSE) |
| GET | [`/api/v1/admin/data-changes`](./access-control.md#get-apiv1admindata-changes) | List row changes (newest first) |
| GET | [`/api/v1/admin/data-changes/{id}`](./access-control.md#get-apiv1admindata-changesid) | Get one complete row-change record |
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
| GET | [`/api/v1/admin/invites/availability`](./platform-admin.md#get-apiv1admininvitesavailability) | Whether a new merchant may be invited |
| GET | [`/api/v1/admin/invites/preview-email`](./platform-admin.md#get-apiv1admininvitespreview-email) | Preview merchant invite email (does not send) |
| GET | [`/api/v1/admin/location-requests`](./platform-admin.md#get-apiv1adminlocation-requests) | List pending tenant store location requests |
| GET | [`/api/v1/admin/merchants`](./platform-admin.md#get-apiv1adminmerchants) | List merchant tenants |
| GET | [`/api/v1/admin/merchants/{tenantId}`](./platform-admin.md#get-apiv1adminmerchantstenantid) | Get merchant tenant detail for KYB review |
| POST | [`/api/v1/admin/merchants/{tenantId}/appeals/{appealId}/reject`](./platform-admin.md#post-apiv1adminmerchantstenantidappealsappealidreject) | Reject a tenant's pending appeal against its suspension |
| POST | [`/api/v1/admin/merchants/{tenantId}/ban`](./platform-admin.md#post-apiv1adminmerchantstenantidban) | SuperAdmin: ban an active, restricted or suspended tenant |
| GET | [`/api/v1/admin/merchants/{tenantId}/documents/{documentId}/download`](./platform-admin.md#get-apiv1adminmerchantstenantiddocumentsdocumentiddownload) | Get a short-lived signed download URL for a merchant KYB document |
| PATCH | [`/api/v1/admin/merchants/{tenantId}/kyb`](./platform-admin.md#patch-apiv1adminmerchantstenantidkyb) | Update merchant KYB status (REJECTED / ACTION_REQUIRED require kybFields.rejectionReason) |
| GET | [`/api/v1/admin/merchants/{tenantId}/lifecycle`](./platform-admin.md#get-apiv1adminmerchantstenantidlifecycle) | Read a tenant's lifecycle state, current suspension and appeals |
| POST | [`/api/v1/admin/merchants/{tenantId}/locations`](./platform-admin.md#post-apiv1adminmerchantstenantidlocations) | Create a tenant store location |
| PATCH | [`/api/v1/admin/merchants/{tenantId}/locations/{locationId}/review`](./platform-admin.md#patch-apiv1adminmerchantstenantidlocationslocationidreview) | Approve or reject a tenant store location request |
| POST | [`/api/v1/admin/merchants/{tenantId}/reinstate`](./platform-admin.md#post-apiv1adminmerchantstenantidreinstate) | Reinstate a suspended tenant (its pending appeal is accepted with this reason) |
| POST | [`/api/v1/admin/merchants/{tenantId}/suspend`](./platform-admin.md#post-apiv1adminmerchantstenantidsuspend) | Suspend an active or restricted tenant: only its lifecycle routes keep working |
| POST | [`/api/v1/admin/merchants/{tenantId}/unban`](./platform-admin.md#post-apiv1adminmerchantstenantidunban) | SuperAdmin: lift a tenant's ban (it is active again) |
| GET | [`/api/v1/admin/rewards/{rewardId}`](./platform-admin.md#get-apiv1adminrewardsrewardid) | Get one reward in full, whatever its status (moderation detail) |
| POST | [`/api/v1/admin/rewards/{rewardId}/approve`](./platform-admin.md#post-apiv1adminrewardsrewardidapprove) | Approve a pending reward (no body required) |
| GET | [`/api/v1/admin/rewards/{rewardId}/images/{fileId}/download`](./platform-admin.md#get-apiv1adminrewardsrewardidimagesfileiddownload) | Get a short-lived signed URL that downloads one of a reward's images (the original upload) |
| GET | [`/api/v1/admin/rewards/{rewardId}/images/archive`](./platform-admin.md#get-apiv1adminrewardsrewardidimagesarchive) | Download every image of a reward as one ZIP of the original uploads, in display order |
| POST | [`/api/v1/admin/rewards/{rewardId}/reject`](./platform-admin.md#post-apiv1adminrewardsrewardidreject) | Reject a pending reward |
| GET | [`/api/v1/admin/rewards/pending`](./platform-admin.md#get-apiv1adminrewardspending) | List rewards pending moderation (oldest first, paginated) |
| POST | [`/api/v1/admin/tenants/invites`](./merchant-tenants.md#post-apiv1admintenantsinvites) |  |
| POST | [`/api/v1/tenants/{tenantSlug}/access-requests`](./merchant-tenants.md#post-apiv1tenantstenantslugaccess-requests) |  |
| POST | [`/api/v1/tenants/{tenantSlug}/access-requests/{requestId}/review`](./merchant-tenants.md#post-apiv1tenantstenantslugaccess-requestsrequestidreview) |  |
| GET | [`/api/v1/tenants/{tenantSlug}/analytics`](./merchant-tenants.md#get-apiv1tenantstenantsluganalytics) | Tenant reward performance analytics |
| GET | [`/api/v1/tenants/{tenantSlug}/analytics/dashboard`](./merchant-tenants.md#get-apiv1tenantstenantsluganalyticsdashboard) | Merchant analytics dashboard: custom range + interval, compared totals, series, store / reward / redemption-method breakdowns |
| GET | [`/api/v1/tenants/{tenantSlug}/analytics/export`](./merchant-tenants.md#get-apiv1tenantstenantsluganalyticsexport) | Download the merchant analytics report (csv \| xlsx \| pdf) for a date range |
| GET | [`/api/v1/tenants/{tenantSlug}/api-keys`](./merchant-tenants.md#get-apiv1tenantstenantslugapi-keys) | List tenant API keys |
| POST | [`/api/v1/tenants/{tenantSlug}/api-keys`](./merchant-tenants.md#post-apiv1tenantstenantslugapi-keys) | Create a POS API key |
| POST | [`/api/v1/tenants/{tenantSlug}/api-keys/{keyId}/revoke`](./merchant-tenants.md#post-apiv1tenantstenantslugapi-keyskeyidrevoke) | Revoke a POS API key (no body required) |
| GET | [`/api/v1/tenants/{tenantSlug}/context`](./merchant-tenants.md#get-apiv1tenantstenantslugcontext) |  |
| GET | [`/api/v1/tenants/{tenantSlug}/customer-bans`](./merchant-tenants.md#get-apiv1tenantstenantslugcustomer-bans) | List the tenant's active customer bans, newest first |
| POST | [`/api/v1/tenants/{tenantSlug}/customer-bans`](./merchant-tenants.md#post-apiv1tenantstenantslugcustomer-bans) | Ban the customer behind one of the tenant's redemptions |
| POST | [`/api/v1/tenants/{tenantSlug}/customer-bans/{banId}/lift`](./merchant-tenants.md#post-apiv1tenantstenantslugcustomer-bansbanidlift) | Lift a customer ban: the customer may claim and redeem again |
| GET | [`/api/v1/tenants/{tenantSlug}/kyb`](./merchant-tenants.md#get-apiv1tenantstenantslugkyb) | Get the tenant KYB profile (owner only) |
| PATCH | [`/api/v1/tenants/{tenantSlug}/kyb`](./merchant-tenants.md#patch-apiv1tenantstenantslugkyb) | Submit or resubmit business verification details (owner only) |
| GET | [`/api/v1/tenants/{tenantSlug}/kyb/documents/{documentId}/download`](./merchant-tenants.md#get-apiv1tenantstenantslugkybdocumentsdocumentiddownload) | Get a short-lived signed download URL for a CLEAN KYB document (owner only) |
| GET | [`/api/v1/tenants/{tenantSlug}/lifecycle`](./merchant-tenants.md#get-apiv1tenantstenantsluglifecycle) |  |
| POST | [`/api/v1/tenants/{tenantSlug}/lifecycle/appeals`](./merchant-tenants.md#post-apiv1tenantstenantsluglifecycleappeals) |  |
| POST | [`/api/v1/tenants/{tenantSlug}/lifecycle/reactivate`](./merchant-tenants.md#post-apiv1tenantstenantsluglifecyclereactivate) |  |
| POST | [`/api/v1/tenants/{tenantSlug}/locations`](./merchant-tenants.md#post-apiv1tenantstenantsluglocations) |  |
| PATCH | [`/api/v1/tenants/{tenantSlug}/locations/{locationId}`](./merchant-tenants.md#patch-apiv1tenantstenantsluglocationslocationid) |  |
| POST | [`/api/v1/tenants/{tenantSlug}/locations/{locationId}/close`](./merchant-tenants.md#post-apiv1tenantstenantsluglocationslocationidclose) |  |
| GET | [`/api/v1/tenants/{tenantSlug}/members`](./merchant-tenants.md#get-apiv1tenantstenantslugmembers) |  |
| POST | [`/api/v1/tenants/{tenantSlug}/members/{membershipId}/locations/{locationId}/remove`](./merchant-tenants.md#post-apiv1tenantstenantslugmembersmembershipidlocationslocationidremove) |  |
| POST | [`/api/v1/tenants/{tenantSlug}/members/invite`](./merchant-tenants.md#post-apiv1tenantstenantslugmembersinvite) |  |
| GET | [`/api/v1/tenants/{tenantSlug}/members/invites`](./merchant-tenants.md#get-apiv1tenantstenantslugmembersinvites) |  |
| POST | [`/api/v1/tenants/{tenantSlug}/members/invites/{inviteId}/revoke`](./merchant-tenants.md#post-apiv1tenantstenantslugmembersinvitesinviteidrevoke) |  |
| PATCH | [`/api/v1/tenants/{tenantSlug}/members/me`](./merchant-tenants.md#patch-apiv1tenantstenantslugmembersme) |  |
| POST | [`/api/v1/tenants/{tenantSlug}/members/me/leave`](./merchant-tenants.md#post-apiv1tenantstenantslugmembersmeleave) |  |
| GET | [`/api/v1/tenants/{tenantSlug}/redemptions`](./merchant-tenants.md#get-apiv1tenantstenantslugredemptions) | List tenant redemptions |
| GET | [`/api/v1/tenants/{tenantSlug}/rewards`](./merchant-tenants.md#get-apiv1tenantstenantslugrewards) | List tenant rewards |
| POST | [`/api/v1/tenants/{tenantSlug}/rewards`](./merchant-tenants.md#post-apiv1tenantstenantslugrewards) | Create a draft reward |
| GET | [`/api/v1/tenants/{tenantSlug}/rewards/{rewardId}`](./merchant-tenants.md#get-apiv1tenantstenantslugrewardsrewardid) | Read one tenant reward (404 when not offered at any of the caller's stores) |
| PATCH | [`/api/v1/tenants/{tenantSlug}/rewards/{rewardId}`](./merchant-tenants.md#patch-apiv1tenantstenantslugrewardsrewardid) | Update a draft or pending reward |
| POST | [`/api/v1/tenants/{tenantSlug}/rewards/{rewardId}/publish`](./merchant-tenants.md#post-apiv1tenantstenantslugrewardsrewardidpublish) | Submit reward for moderation review (no body required) |
| GET | [`/api/v1/tenants/{tenantSlug}/rewards/summary`](./merchant-tenants.md#get-apiv1tenantstenantslugrewardssummary) | Tenant reward figures: the count in each status and the units still claimable, over every reward in the store scope |
| GET | [`/api/v1/tenants/{tenantSlug}/terminals`](./merchant-tenants.md#get-apiv1tenantstenantslugterminals) | List the tenant's POS terminals |
| POST | [`/api/v1/tenants/{tenantSlug}/terminals`](./merchant-tenants.md#post-apiv1tenantstenantslugterminals) | Register a POS terminal at a store and get its one-time pairing code |
| GET | [`/api/v1/tenants/{tenantSlug}/terminals/{id}`](./merchant-tenants.md#get-apiv1tenantstenantslugterminalsid) | Read one POS terminal (404 outside the caller's stores) |
| DELETE | [`/api/v1/tenants/{tenantSlug}/terminals/{id}`](./merchant-tenants.md#delete-apiv1tenantstenantslugterminalsid) | Remove a POS terminal and revoke its API key |
| POST | [`/api/v1/tenants/{tenantSlug}/terminals/{id}/pairing-code`](./merchant-tenants.md#post-apiv1tenantstenantslugterminalsidpairing-code) | Issue a new pairing code (first pairing, expired code, or re-pair — the old key stops working once the new code is used) |
| GET | [`/api/v1/tenants/{tenantSlug}/terminals/settings`](./merchant-tenants.md#get-apiv1tenantstenantslugterminalssettings) | Read the tenant's POS terminal policy |
| PATCH | [`/api/v1/tenants/{tenantSlug}/terminals/settings`](./merchant-tenants.md#patch-apiv1tenantstenantslugterminalssettings) | Turn 'only allow registered terminals' on or off |
| GET | [`/api/v1/tenants/{tenantSlug}/terminals/summary`](./merchant-tenants.md#get-apiv1tenantstenantslugterminalssummary) | Count the tenant's live POS terminals per status, within the caller's stores |
| POST | [`/api/v1/tenants/invites/accept`](./merchant-tenants.md#post-apiv1tenantsinvitesaccept) |  |
| POST | [`/api/v1/tenants/invites/register-and-accept`](./merchant-tenants.md#post-apiv1tenantsinvitesregister-and-accept) |  |
| POST | [`/api/v1/tenants/invites/validate`](./merchant-tenants.md#post-apiv1tenantsinvitesvalidate) |  |
| GET | [`/api/v1/tenants/memberships`](./merchant-tenants.md#get-apiv1tenantsmemberships) | List the current user's tenant memberships |
| POST | [`/api/v1/tenants/onboarding/complete`](./merchant-tenants.md#post-apiv1tenantsonboardingcomplete) | Complete merchant onboarding — links OWNER membership and platform User role |
| POST | [`/api/v1/tenants/onboarding/documents/status`](./merchant-tenants.md#post-apiv1tenantsonboardingdocumentsstatus) | Scan status of this onboarding's KYB uploads (same document window as the upload endpoints) |
| POST | [`/api/v1/tenants/onboarding/documents/submit`](./merchant-tenants.md#post-apiv1tenantsonboardingdocumentssubmit) | Attach onboarding KYB documents and submit the merchant for admin review |
| POST | [`/api/v1/tenants/onboarding/documents/upload-complete`](./merchant-tenants.md#post-apiv1tenantsonboardingdocumentsupload-complete) | Complete an invite-authorized KYB document upload |
| POST | [`/api/v1/tenants/onboarding/documents/upload-complete-batch`](./merchant-tenants.md#post-apiv1tenantsonboardingdocumentsupload-complete-batch) | Complete invite-authorized KYB document uploads in one request |
| POST | [`/api/v1/tenants/onboarding/documents/upload-url`](./merchant-tenants.md#post-apiv1tenantsonboardingdocumentsupload-url) | Create an invite-authorized KYB document upload ticket |
| POST | [`/api/v1/tenants/onboarding/documents/upload-urls`](./merchant-tenants.md#post-apiv1tenantsonboardingdocumentsupload-urls) | Create invite-authorized KYB document upload tickets in one request |
| POST | [`/api/v1/tenants/onboarding/validate`](./merchant-tenants.md#post-apiv1tenantsonboardingvalidate) | Validate a merchant onboarding invite token |
| GET | [`/api/v1/claims`](./customer-rewards.md#get-apiv1claims) | List my reward claims |
| POST | [`/api/v1/claims`](./customer-rewards.md#post-apiv1claims) | Claim a reward after OTP verification |
| GET | [`/api/v1/claims/{claimId}`](./customer-rewards.md#get-apiv1claimsclaimid) | One of my claims (never carries the codes) |
| POST | [`/api/v1/claims/{claimId}/qr`](./customer-rewards.md#post-apiv1claimsclaimidqr) | Issue fresh QR and backup codes for an active claim (the previous codes stop working) |
| GET | [`/api/v1/claims/analytics`](./customer-rewards.md#get-apiv1claimsanalytics) | Reward activity analytics for the signed-in user |
| GET | [`/api/v1/claims/analytics/dashboard`](./customer-rewards.md#get-apiv1claimsanalyticsdashboard) | My analytics dashboard: custom range + interval, compared totals, series, spending by category / merchant over time |
| POST | [`/api/v1/claims/otp`](./customer-rewards.md#post-apiv1claimsotp) | Request claim OTP (emailed to your account — no SMS in dev) |
| POST | [`/api/v1/legal/accept`](./customer-rewards.md#post-apiv1legalaccept) | Accept rewards terms and privacy policy |
| GET | [`/api/v1/legal/status`](./customer-rewards.md#get-apiv1legalstatus) | Get rewards legal acceptance and verified phone status |
| POST | [`/api/v1/referrals/attribution`](./customer-rewards.md#post-apiv1referralsattribution) | Remember the referral link the caller opened |
| POST | [`/api/v1/referrals/rewards/{rewardId}/links`](./customer-rewards.md#post-apiv1referralsrewardsrewardidlinks) | Mint a share link for a reward |
| GET | [`/api/v1/reward-notifications`](./customer-rewards.md#get-apiv1reward-notifications) | List in-app reward notifications |
| POST | [`/api/v1/reward-notifications/read`](./customer-rewards.md#post-apiv1reward-notificationsread) | Mark reward notifications as read |
| GET | [`/api/v1/rewards`](./customer-rewards.md#get-apiv1rewards) | Browse published consumer rewards |
| GET | [`/api/v1/rewards/{rewardId}`](./customer-rewards.md#get-apiv1rewardsrewardid) | Get published reward detail |
| GET | [`/api/v1/integration/analytics`](./pos.md#get-apiv1integrationanalytics) | The API key's tenant reward performance analytics |
| GET | [`/api/v1/integration/analytics/dashboard`](./pos.md#get-apiv1integrationanalyticsdashboard) | The API key's tenant analytics dashboard |
| GET | [`/api/v1/integration/analytics/export`](./pos.md#get-apiv1integrationanalyticsexport) | Download the API key's tenant analytics report (csv \| xlsx \| pdf) |
| GET | [`/api/v1/integration/redemptions`](./pos.md#get-apiv1integrationredemptions) | List the API key's own redemptions |
| POST | [`/api/v1/integration/redemptions/checkout`](./pos.md#post-apiv1integrationredemptionscheckout) | POS checkout: after payment, record the bill and redeem every presented reward (all-or-nothing, idempotent) |
| POST | [`/api/v1/integration/redemptions/validate`](./pos.md#post-apiv1integrationredemptionsvalidate) | POS validate QR or backup code |
| GET | [`/api/v1/integration/rewards`](./pos.md#get-apiv1integrationrewards) | List the API key's tenant rewards |
| POST | [`/api/v1/integration/rewards`](./pos.md#post-apiv1integrationrewards) | Create a draft reward for the API key's tenant |
| GET | [`/api/v1/integration/rewards/{rewardId}`](./pos.md#get-apiv1integrationrewardsrewardid) | Read one of the API key's tenant rewards (404 when not offered at the key's store) |
| PATCH | [`/api/v1/integration/rewards/{rewardId}`](./pos.md#patch-apiv1integrationrewardsrewardid) | Update a draft or pending reward of the API key's tenant |
| POST | [`/api/v1/integration/rewards/{rewardId}/publish`](./pos.md#post-apiv1integrationrewardsrewardidpublish) | Submit one of the API key's tenant rewards for moderation review (no body required) |
| GET | [`/api/v1/integration/rewards/summary`](./pos.md#get-apiv1integrationrewardssummary) | The API key's tenant reward figures: the count in each status and the units still claimable |
| POST | [`/api/v1/integration/terminals/pair`](./pos.md#post-apiv1integrationterminalspair) | Pair a POS terminal with the one-time code from the merchant console |
| GET | [`/api/v1/files/{fileId}`](./files.md#get-apiv1filesfileid) | Get file metadata |
| DELETE | [`/api/v1/files/{fileId}`](./files.md#delete-apiv1filesfileid) | Soft-delete a file and queue physical deletion |
| POST | [`/api/v1/files/{fileId}/complete`](./files.md#post-apiv1filesfileidcomplete) | Complete a direct upload after browser upload |
| GET | [`/api/v1/files/{fileId}/download-url`](./files.md#get-apiv1filesfileiddownload-url) | Get a short-lived download URL for a private file |
| GET | [`/api/v1/files/{fileId}/local-public`](./files.md#get-apiv1filesfileidlocal-public) | Serve a READY public asset from local storage (development only) |
| POST | [`/api/v1/files/{fileId}/local-upload`](./files.md#post-apiv1filesfileidlocal-upload) | Receive a browser multipart upload for a signed local-storage ticket (development only) |
| GET | [`/api/v1/files/{fileId}/variants/{variant}/local-public`](./files.md#get-apiv1filesfileidvariantsvariantlocal-public) | Serve a rendition of a READY public image from local storage (development only) |
| GET | [`/api/v1/files/local-download`](./files.md#get-apiv1fileslocal-download) | Download a private object through a signed, expiring local-storage link (development only) |
| POST | [`/api/v1/files/processing-callback`](./files.md#post-apiv1filesprocessing-callback) | External processing callback for file lifecycle updates |
| POST | [`/api/v1/files/upload-url`](./files.md#post-apiv1filesupload-url) | Create a browser upload ticket |
| POST | [`/api/v1/tenants/{tenantSlug}/files/upload-url`](./files.md#post-apiv1tenantstenantslugfilesupload-url) | Create a browser upload ticket for a tenant-owned file |
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
| GET | [`/api/v1/github/repositories`](./github.md#get-apiv1githubrepositories) | List the GitHub repositories the API may read |
| GET | [`/api/v1/github/repositories/{owner}/{repository}`](./github.md#get-apiv1githubrepositoriesownerrepository) | Summary of a configured repository: stars, forks, languages, commit count, last push |
| GET | [`/api/v1/github/repositories/{owner}/{repository}/commits`](./github.md#get-apiv1githubrepositoriesownerrepositorycommits) | One page of a configured repository's commit history with lines added/deleted per commit |
| GET | [`/api/v1/github/repositories/{owner}/{repository}/commits/{sha}`](./github.md#get-apiv1githubrepositoriesownerrepositorycommitssha) | One commit of a configured repository: its message, parents and every changed file with its diff |
| GET | [`/api/v1/github/repositories/{owner}/{repository}/contributors`](./github.md#get-apiv1githubrepositoriesownerrepositorycontributors) | Commits and lines added/deleted per contributor of a configured repository |
| GET | [`/api/v1/github/account`](./github-pull-requests.md#get-apiv1githubaccount) | Your GitHub link |
| PUT | [`/api/v1/github/account`](./github-pull-requests.md#put-apiv1githubaccount) | Link (or replace) your fine-grained GitHub token |
| DELETE | [`/api/v1/github/account`](./github-pull-requests.md#delete-apiv1githubaccount) | Forget your GitHub token |
| GET | [`/api/v1/github/content-edits/{nodeId}`](./github-pull-requests.md#get-apiv1githubcontent-editsnodeid) | Every saved version of a comment, review or pull request description |
| GET | [`/api/v1/github/live-updates/{owner}/{repository}`](./github-pull-requests.md#get-apiv1githublive-updatesownerrepository) | Whether a repository's pull requests update live |
| PUT | [`/api/v1/github/live-updates/{owner}/{repository}`](./github-pull-requests.md#put-apiv1githublive-updatesownerrepository) | Turn a repository's live updates on |
| DELETE | [`/api/v1/github/live-updates/{owner}/{repository}`](./github-pull-requests.md#delete-apiv1githublive-updatesownerrepository) | Turn a repository's live updates off |
| GET | [`/api/v1/github/live-updates/{owner}/{repository}/events`](./github-pull-requests.md#get-apiv1githublive-updatesownerrepositoryevents) | One repository's pull-request changes, live (SSE) |
| GET | [`/api/v1/github/pictures/file`](./github-pull-requests.md#get-apiv1githubpicturesfile) | A picture kept in a repository, read with your GitHub token |
| GET | [`/api/v1/github/pictures/uploads/{attachmentId}`](./github-pull-requests.md#get-apiv1githubpicturesuploadsattachmentid) | An upload to a private repository, shown in a comment |
| GET | [`/api/v1/github/pull-requests`](./github-pull-requests.md#get-apiv1githubpull-requests) | One page of your pull requests |
| GET | [`/api/v1/github/pull-requests/{owner}/{repository}/{number}`](./github-pull-requests.md#get-apiv1githubpull-requestsownerrepositorynumber) | One pull request with the first page of its conversation |
| POST | [`/api/v1/github/pull-requests/{owner}/{repository}/{number}/comments`](./github-pull-requests.md#post-apiv1githubpull-requestsownerrepositorynumbercomments) | Comment on a pull request's conversation |
| GET | [`/api/v1/github/pull-requests/{owner}/{repository}/{number}/commits`](./github-pull-requests.md#get-apiv1githubpull-requestsownerrepositorynumbercommits) | A pull request's commits, oldest first |
| GET | [`/api/v1/github/pull-requests/{owner}/{repository}/{number}/commits/{sha}`](./github-pull-requests.md#get-apiv1githubpull-requestsownerrepositorynumbercommitssha) | One of a pull request's commits with its changed files and diffs |
| GET | [`/api/v1/github/pull-requests/{owner}/{repository}/{number}/files`](./github-pull-requests.md#get-apiv1githubpull-requestsownerrepositorynumberfiles) | One page of a pull request's changed files with their diffs |
| POST | [`/api/v1/github/pull-requests/{owner}/{repository}/{number}/merge`](./github-pull-requests.md#post-apiv1githubpull-requestsownerrepositorynumbermerge) | Merge a pull request, and optionally delete its branch |
| POST | [`/api/v1/github/pull-requests/{owner}/{repository}/{number}/pictures`](./github-pull-requests.md#post-apiv1githubpull-requestsownerrepositorynumberpictures) | Commit an uploaded picture to the repository, to link from a comment |
| PUT | [`/api/v1/github/pull-requests/{owner}/{repository}/{number}/reactions`](./github-pull-requests.md#put-apiv1githubpull-requestsownerrepositorynumberreactions) | Set your emoji reaction on a pull request or one of its comments, on or off |
| GET | [`/api/v1/github/pull-requests/{owner}/{repository}/{number}/review-threads`](./github-pull-requests.md#get-apiv1githubpull-requestsownerrepositorynumberreview-threads) | The conversations on lines of a pull request's diff |
| POST | [`/api/v1/github/pull-requests/{owner}/{repository}/{number}/reviews`](./github-pull-requests.md#post-apiv1githubpull-requestsownerrepositorynumberreviews) | Review a pull request: comment, approve or request changes |
| GET | [`/api/v1/github/pull-requests/{owner}/{repository}/{number}/status`](./github-pull-requests.md#get-apiv1githubpull-requestsownerrepositorynumberstatus) | A pull request's merge box: checks and conflicts |
| GET | [`/api/v1/github/pull-requests/{owner}/{repository}/{number}/timeline`](./github-pull-requests.md#get-apiv1githubpull-requestsownerrepositorynumbertimeline) | A later page of a pull request's conversation |
| GET | [`/api/v1/github/webhook`](./github-pull-requests.md#get-apiv1githubwebhook) | What this address is (GitHub posts webhook deliveries here) |
| POST | [`/api/v1/github/webhook`](./github-pull-requests.md#post-apiv1githubwebhook) | Receive a GitHub webhook delivery |
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
| GET | [`/api/v1/admin/kanban/board`](./kanban.md#get-apiv1adminkanbanboard) | One board: its columns left to right, each with its items top to bottom |
| PATCH | [`/api/v1/admin/kanban/columns/{columnId}`](./kanban.md#patch-apiv1adminkanbancolumnscolumnid) | Set or clear a column's soft WIP limit (optimistic lock: send the version you read); answers that board |
| POST | [`/api/v1/admin/kanban/columns/{columnId}/move`](./kanban.md#post-apiv1adminkanbancolumnscolumnidmove) | Move a column right of another on its board (or first); answers that board |
| GET | [`/api/v1/admin/kanban/items`](./kanban.md#get-apiv1adminkanbanitems) | Live items of either board, by type and title (a parent or link picker), paginated |
| GET | [`/api/v1/admin/kanban/people`](./kanban.md#get-apiv1adminkanbanpeople) | Everyone an item or a subtask can be assigned to (holds READ on KANBAN_TASK), by name |
| GET | [`/api/v1/admin/kanban/search`](./kanban.md#get-apiv1adminkanbansearch) | Live items ranked for a lookup: the exact key first, then keys that start with the text, then titles that contain it |
| POST | [`/api/v1/admin/kanban/tasks`](./kanban.md#post-apiv1adminkanbantasks) | Create an item at the bottom of a column of its board; the caller reports and watches it |
| GET | [`/api/v1/admin/kanban/tasks/{taskId}`](./kanban.md#get-apiv1adminkanbantaskstaskid) | One item with its column, children, links, checklists, watchers and attachments |
| PATCH | [`/api/v1/admin/kanban/tasks/{taskId}`](./kanban.md#patch-apiv1adminkanbantaskstaskid) | Edit an item's fields and checklists (optimistic lock: send the version you read; 409 KANBAN_TASK_STALE otherwise) |
| DELETE | [`/api/v1/admin/kanban/tasks/{taskId}`](./kanban.md#delete-apiv1adminkanbantaskstaskid) | Soft-delete an item with no live children; the items below it move up |
| GET | [`/api/v1/admin/kanban/tasks/{taskId}/activity`](./kanban.md#get-apiv1adminkanbantaskstaskidactivity) | An item's history, newest first (paginated) |
| POST | [`/api/v1/admin/kanban/tasks/{taskId}/attachments`](./kanban.md#post-apiv1adminkanbantaskstaskidattachments) | Attach a READY KANBAN_TASK_ATTACHMENT file the caller uploaded (POST /files/upload-url) |
| DELETE | [`/api/v1/admin/kanban/tasks/{taskId}/attachments/{attachmentId}`](./kanban.md#delete-apiv1adminkanbantaskstaskidattachmentsattachmentid) | Remove an attachment: its file is deleted and its stored copy purged |
| GET | [`/api/v1/admin/kanban/tasks/{taskId}/attachments/{attachmentId}/download`](./kanban.md#get-apiv1adminkanbantaskstaskidattachmentsattachmentiddownload) | A short-lived signed URL that downloads an attachment's original upload |
| PATCH | [`/api/v1/admin/kanban/tasks/{taskId}/checklist/{itemId}`](./kanban.md#patch-apiv1adminkanbantaskstaskidchecklistitemid) | Tick a subtask or an acceptance criterion off, or on again (a set, safe to retry); answers the item |
| GET | [`/api/v1/admin/kanban/tasks/{taskId}/comments`](./kanban.md#get-apiv1adminkanbantaskstaskidcomments) | A task's comments, newest first (paginated) |
| POST | [`/api/v1/admin/kanban/tasks/{taskId}/comments`](./kanban.md#post-apiv1adminkanbantaskstaskidcomments) | Comment on a task as the signed-in staff member |
| POST | [`/api/v1/admin/kanban/tasks/{taskId}/links`](./kanban.md#post-apiv1adminkanbantaskstaskidlinks) | Link the item to another live item (blocks, blocked by, relates to); 409 when already linked. Answers the item |
| DELETE | [`/api/v1/admin/kanban/tasks/{taskId}/links/{linkId}`](./kanban.md#delete-apiv1adminkanbantaskstaskidlinkslinkid) | Remove one of the item's links (either end); answers the item |
| POST | [`/api/v1/admin/kanban/tasks/{taskId}/move`](./kanban.md#post-apiv1adminkanbantaskstaskidmove) | Move an item into a column of its board, right below another item (or to the top); answers that board |
| POST | [`/api/v1/admin/kanban/tasks/{taskId}/parent`](./kanban.md#post-apiv1adminkanbantaskstaskidparent) | Move to…: put an item under another parent one level up; it keeps its column and place |
| PUT | [`/api/v1/admin/kanban/tasks/{taskId}/watch`](./kanban.md#put-apiv1adminkanbantaskstaskidwatch) | Watch the item as the signed-in staff member (idempotent); answers the item |
| DELETE | [`/api/v1/admin/kanban/tasks/{taskId}/watch`](./kanban.md#delete-apiv1adminkanbantaskstaskidwatch) | Stop watching the item (idempotent); answers the item |
| POST | [`/api/v1/admin/kanban/tasks/import`](./kanban.md#post-apiv1adminkanbantasksimport) | Create several items on one board at once (a CSV import), each at the bottom of its column; all or none. Answers that board |
| GET | [`/`](./system.md#get) | Welcome message |
| GET | [`/health`](./system.md#get-health) | Health check (includes DB status) — deprecated alias, prefer /health/live and /health/ready |
| GET | [`/health/deep`](./system.md#get-healthdeep) | Deep health check (DB + filesystem + external services) |
| GET | [`/health/live`](./system.md#get-healthlive) | Liveness probe — process is up (never touches the database) |
| GET | [`/health/ping`](./system.md#get-healthping) | Connection-quality probe — the apps time this round trip (never touches the database) |
| GET | [`/health/ready`](./system.md#get-healthready) | Readiness probe — startup finished, database and critical dependencies reachable |
| GET | [`/version`](./system.md#get-version) | API version manifest (current, supported, docs) |
