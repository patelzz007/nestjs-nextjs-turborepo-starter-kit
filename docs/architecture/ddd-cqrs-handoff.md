---
title: "DDD/CQRS migration: handoff and pending work"
description: "Where the DDD + CQRS migration stands, how to resume it, and every task still open."
tags: ["architecture", "ddd", "cqrs", "migration"]
author: "Platform Team"
lastUpdated: 1792368000000
coverImage: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=80"
order: 99
---

# DDD/CQRS migration: handoff (2026-10-19)

Read this first when resuming. The rules live in `ddd-cqrs-migration-plan.md` (decisions #1–#74, tasks T01–T49) and `ddd-cqrs-spec.md`. `ddd-cqrs-migration-gaps.md` is the previous implementer's (Composer's) gap list. Everything below supersedes it where the two differ.

## 0. Session 2 progress (resume HERE; §1–§3 below are the original handoff)

Composer's snapshot is now tagged: `git tag ddd-composer-snapshot` (= `a0387300d`). Still nothing committed.

### 0.1 Done in session 2

- **Gate triage (step 1), partly:**
  - `pnpm run typecheck` is green across the repo (fixed identity name clashes, branded `EpochMs` in tests, GitHub test imports, `routeOptions` / `sid` in `test/support/http-execution-context.ts`, seed `actor`, etc.).
  - Frontend lint (admin, web, merchant, client, ui, mobile, eslint-config) is green.
  - The frontend context rule is now real per-context blocks (`frontendContextBoundaryConfigs` / `mobileContextBoundaryConfigs` in `packages/eslint-config/import-boundaries.js`, plan §12.2). Routes, feature stores and lib may import any context file. A context may import another context only through its index, and relative `../../<ctx>/x` imports are caught too. Fixtures are in `__tests__/import-boundaries.frontend.test.js`.
  - `CLIENT_ONLY_WIDGETS` is passed by each workspace's `eslint.config.js`. Command-palette wrappers were created in all 3 apps (`components/layout/*command-palette.client-only.tsx`). The admin showcase dropped `ssr: false`.
  - **Still missing (step 13):** the `image-crop-dialog.client-only.tsx` and KYB `document-preview-dialog.client-only.tsx` wrappers that the allowlist names.
  - The DDD docs' front matter is fixed (step 17, first bullet).
  - The shared contract snapshot was updated. The diff was additions only: the 4 notification exports plus `MERCHANT_CAPABILITY_CEDAR_ACTIONS`.
- **API lint:** only 18 `injectable-should-be-provided` errors are left, all from the unwired new identity layer (needs `IdentityModule`, below).
- **Files ↔ owners (step 9 for files):** the files transitional registrations are deleted. Every owner now registers its own rule, guard and handlers, following catalog's shape:
  - `identity/infrastructure/persistence/identity-file-registrations.ts`: USER_AVATAR. **Not yet provided by any module; add it to `IdentityModule`.**
  - `organizations/infrastructure/persistence/organizations-file-registrations.ts`: STORE_LOGO, STORE_BANNER, MERCHANT_KYB. It is in `OrganizationsModule`.
  - `rewards/infrastructure/persistence/rewards-file-registrations.ts`: REWARD_IMAGE. It uses the new organizations port `ORGANIZATION_FILE_ACCESS` (`OrganizationFileAccessPort.ruleFor(categories, capabilities)`), which `OrganizationAccessModule` provides and `public-api.ts` exports.
  - `integrations-github/infrastructure/adapters/github-file-registrations.ts`: GITHUB_COMMENT_IMAGE.
  - Catalog: `CatalogFileRegistrations` now also registers the PRODUCT_IMAGE access rule.
  - Files exports `fileForbidden`, `uploaderOnly` and `isOwnPersonalUpload`. `FilesModule` imports no context.
  - Specs are in each owner's `application/__tests__/`.
- **Rewards runtime:** the dead `RewardRepository` methods and the dead reward mapper are removed. Only `findClaimableConsumer` / `findTitleById` / `mapClaimToResponse` remain, for legacy claims. Added `rewards/infrastructure/persistence/__tests__/reward-list-queries.spec.ts`.
- **Moves:**
  - `RewardCodeHasher` → `platform/infrastructure/crypto/reward-code-hasher.ts`.
  - The cross-context list-translator spec → `src/contexts/__tests__/`.
  - `notifications/public-api.ts` and `files/public-api.ts` now export their module class LAST.

### 0.2 Key findings / decisions (apply them going forward)

- **The app does NOT boot** (e2e `test/app.e2e-spec.ts` against `ddd_b1`). Two causes:
  1. The JS barrel cycle between organizations and legacy identity: `OrganizationsModule` imports `identity/auth/auth.module`, which reaches back.
  2. Nothing provides `ACCESS_TOKEN_VERIFIER`, `ACCESS_TOKEN_STATE`, `IMPERSONATION_TOKEN_CHECK` or `AUTH_FLOW_RECORDER` (from `platform/application/ports/access-token.port.ts`), which `AuthGuard` and `RefreshTokenGuard` inject. The new `IdentityModule` must provide them.
- **Decision (record in ADR 058 + `contexts/README.md`):**
  - `public-api.ts` exports ports, tokens, types, events, errors and transactional factories, plus only **leaf** modules (modules that depend on platform alone: `FilesModule`, `NotificationsModule`, `OrganizationAccessModule`).
  - Composition modules that wire other contexts (`OrganizationsModule`, `IdentityModule`, `AuthorizationModule`) are imported by `app.module.ts` directly from `<ctx>.module.ts`, never re-exported.
  - `IdentityModule` is `@Global` (it owns the security kit), like `AuthorizationModule`.
  - So identity and authorization reach each other's providers by token, with no module import, and there is no `forwardRef`.
  - TODO: remove `OrganizationsModule` and `AuthorizationModule` from their `public-api.ts` and import them directly in `app.module.ts`.
- **Bug to fix in `StopImpersonation`:** the minted access token has no `sid`, and `ActorContextFactory` now treats a sid-less user token as `unresolvable`. Bind it to the impersonator's own device session.
- **Unit test failures left:** the legacy identity specs (`login-verification`, `two-factor`, `task-schedule`, `user-provisioning`) fail on a JS import cycle (`organization-team-invite.controller` → identity internals). They are deleted with `auth/` in step 2. The docs `api-reference.artifact.test.ts` needs `pnpm docs:api` after the controllers settle.
- **The new identity CQRS layer has NO tests.** Organizations' application layer has none either: `__tests__/fakes` is empty, apart from the new file-access specs.

### 0.3 Done since (identity step 2 is mostly complete; the app boots)

- **Referrals, signup half (part of step 6):** `src/contexts/referrals/` is built in full DDD/CQRS layout.
  - Queries `GetMySignupReferralDashboard` and `ListMyReferees`.
  - Commands `MaintainSignupReferralCodes` and `SweepSignupSuccessNotifications`.
  - An hourly cron through `SystemCommandDispatcher`.
  - `SignupReferralApplicationService` behind `SIGNUP_REFERRALS`, and `createReferralsTransactionalPorts(db)` (`signupReferrals`, `signupSuccess`).
  - `SIGNUP_REFERRAL_SUCCESS`, transitional until pos (step 5).
  - Leaf `ReferralsModule`, with specs in every layer.
  - The platform `signup-referral.port.ts` is deleted.
  - **Still open in referrals:** reward-referral crediting (it lives in `rewards/runtime`, steps 5–6), and an e2e spec for `/auth/signup-referrals/{dashboard,referees}`. Those reads now run under the caller's RLS session.
- **`IdentityModule`** (`identity/identity.module.ts`, `@Global`) is wired:
  - 7 controllers in `presentation/http/`: auth, two-factor, mfa-recovery, profile, sessions, session-status, impersonation. Every decorator was kept; impersonate has ONE `@RateLimit(authenticatedMutation)`; `/auth/refresh` uses `sessionRefresh`.
  - `presentation/jobs/identity-maintenance.cron.ts`.
  - The CLI in `presentation/cli/` and `identity/superadmin-bootstrap.composition.ts`. It calls the handler directly; the `package.json` script path is fixed.
  - `REGISTRATION_SIGN_IN`, the port organizations' register-and-accept handler calls, so that controller makes one dispatch.
- **Deleted:**
  - `identity/{auth,sessions,impersonation}`.
  - authorization's `access-token-state`, `user-session-revocation` and `identity-sessions` transitional adapters, and `USER_SESSION_REVOCATION`.
  - organizations' `account-provisioning.transitional-adapter`.
  - identity's `authorization`, `merchant-portal-access` and `signup-referral` transitional adapters.
- **New ports and wiring:**
  - Authorization provides `USER_GRANTS_READ` (`user-grants-read.adapter.ts`).
  - Organizations implements identity's `MERCHANT_PORTAL_ACCESS` in `OrganizationAccessModule`.
  - `MutationIntentGuard` moved to `platform/presentation/http/security/guards/` and into `APP_GUARD_ORDER` (after the pre-auth throttler).
  - `HttpSecurityModule` (global `CookieConfigService`).
  - `clientInfoOf()`.
  - `TrackAuthFlow` now copies reflected metadata onto its wrapper, which fixes the Swagger request bodies.
  - `app.module` mounts `IdentityModule`, `ReferralsModule` and `HttpSecurityModule`.
  - `OrganizationsModule` is no longer exported from `organizations/public-api.ts`.
- **Verified:**
  - API typecheck, API lint and API unit tests are green (3157).
  - Full e2e: 426/439 at first, then these were fixed: Swagger bodies, the rate-limit test (it sent no `content-type`), impersonation fixtures (D36 refuses a second live session; the setup helper `test/support/impersonation.ts` now ends leftovers).
  - The CRITICAL throttler item is proven: `rate-limit-wiring.e2e-spec.ts` passes, with login 429 at limit + 1.
  - **Still failing:** `app.e2e` and `openapi-document` because the `claims.get` / `claims.qr` handlers are missing (step 4), and `openapi-artifact` (regenerate at the end).
- **Next:** see §0.4.

### 0.4 Done in session 3 (identity tests and the `sid` fix)

- **Identity domain specs** (`identity/domain/__tests__/`, 87 tests): every aggregate (`UserAccount`, `DeviceSession`, `TwoFactorEnrollment`, `TwoFactorLoginChallenge`, `MfaRecoveryRequest`, `ImpersonationSession`, `UserProfile`), `PasswordResetToken`, the value objects, and the policies (impersonation start, merchant portal access, own-profile write, session restriction).
- **Ported legacy specs** from `ddd-composer-snapshot` to their subjects' new homes:
  - `identity/infrastructure/security/__tests__/`: crypto, token, access-token state, secret encryption, and `auth-guards.spec.ts` (AuthGuard / RefreshTokenGuard with the real `TokenService` and port fakes, no module mocks). It lives in identity because it needs identity's `TokenService`.
  - Session-device and session-revoker value objects; `platform/.../security/__tests__/` client type, admin access, session-device context; `cookies/__tests__/cookie.config.spec.ts`.
  - The session-location spec moved into `__tests__/`; `track-auth-flow.decorator.spec.ts` moved into `decorators/__tests__/`, with a new metadata-copy test.
- **New specs:** `infrastructure/adapters/__tests__/impersonation-token.check.spec.ts`; e2e `test/identity-transactional-ports.e2e-spec.ts` (`revokeAllSessions` and `createAccount` against the real schema, inside a system-operation RLS transaction).
- **`StopImpersonation` `sid` fix (done):**
  - The controller reads the administrator's own refresh token with `readPresentedRefreshToken` (missing: `401 REFRESH_TOKEN_MISSING`).
  - The handler verifies it, requires `sub` = impersonator, and in the transaction requires `scope.sessions.findById(jti)` to be one of the impersonator's live sessions (`DeviceSession.isLiveFor`, otherwise `RefreshTokenRevokedError`). It then mints the restored token with `sid = jti`.
  - `IdentityTokensPort.generateAccessToken(user, sessionId)` now always sets `sid`.
  - Each app starts and stops impersonation under its own client type, so the browser already sends the right refresh cookie; the frontends needed no change.
  - e2e `impersonation-session.e2e-spec.ts` has 6 cases, including restored-token usability, missing refresh token and a revoked session. The fixture is `openAdminDeviceSession()` in `test/support/impersonation.ts`.
  - Docs: `docs/technical/security/authentication.md`, plus the route's OpenAPI description. Regenerate `docs/technical/api-reference` with `pnpm docs:api`.
- `docs/technical/operations/superadmin-bootstrap.md` paths updated.
- Fixed a slipped value import of `AccessTokenPayload` in `authorization/presentation/http/policy-control-plane.controller.ts` (TS1272).
- **Identity application specs (done, 72 tests):** every command handler (26), every query handler (11) and the after-commit handlers, in `identity/application/__tests__/`:
  - `fakes/identity.fakes.ts`: in-memory repositories for every `IdentityScope` member (the device-session rotation is a compare-and-set, as in Postgres; a lost MFA-recovery review throws like the Prisma repository), plus `InMemoryIdentityUnitOfWork`, which **rolls the store back** when the work throws. It also has deterministic crypto, tokens, authenticator, TOTP cipher, clock and ids, and the actor / account / session builders.
  - `fakes/identity-sign-in.fakes.ts`: `signInHarness()`, which wires the real `SessionIssuer` and `LoginVerificationGate` over the fakes.
  - `fakes/identity-reads.fakes.ts`: the `IdentityReadPort` read model.
  - `UpdateOwnProfileHandler` lost an unused `IDENTITY_READ` injection.
- **Follow-up (behaviour unchanged, needs a decision):** a wrong backup code at sign-in is not counted against the login challenge. TOTP codes are (D19), and the legacy code didn't count backup codes either. Backup codes are high-entropy and HTTP rate limiting applies, but counting them the same way would close the gap.
- **Still open in identity:** an e2e for `/auth/signup-referrals/{dashboard,referees}`.
- **Next:** see §0.5.

### 0.5 Authorization step 3 (session 3)

- **Verified as already done:** one `@RateLimit(adminSecurityMutation)` on every RBAC / policy / support mutation (read-only POSTs use `authenticatedMutation`); `RbacMutationScope` does lock → work → `IdentitySessionsPort` revocation → audit → `UserAuthorizationChanged` in one `runSystemOperation`; D21 (both boot syncs awaited under the catalog advisory lock via `SystemCommandDispatcher`); D22 (`AuthorizationEventEmitter` gone); D23 (`assertActiveReadGrant` gone); D37 (simulate is one system operation).
- **Transitional adapter removed:** `organization-directory.transitional-adapter.ts` is deleted. Organizations' transactional ports gained `existence` (`OrganizationExistencePort`: `exists`, `isActiveOwner`), and the authorization scope factory uses `createOrganizationsTransactionalPorts(db).existence` / `.audit`.
  - **Incident:** creating that port first overwrote organizations' untracked `application/ports/organization-directory.port.ts` (a `cat >` collision). It was rebuilt exactly from its implementer `OrganizationDirectoryAdapter` and its 14 call sites (`ResolvedOrganizationMember`, `resolveOrganizationId`, `resolveMember`, `assertAccessibleLocation`). Typecheck and the organizations suites are green, but the original doc comments were reworded. Review that file.
- **T08 temporary interface removed:** platform's `DefaultRoleAssignmentPort` / `ProvisioningRoleAssignment` / `DEFAULT_ROLE_ASSIGNMENT` and identity's `authorization-role-assignment.adapter.ts` are deleted. `IdentityScope.roles` is authorization's public `DefaultRoleAssignmentPort` (`assignDefaultRole`, `assignPlatformRole`). The adapter had a latent bug: a non-system provisioning actor got the *default* role whatever `roleName` said.
- **Security fix:** `PrismaRbacGraphReader.holdersOfPermission` now includes holders of roles *below* a conferring role (children inherit their ancestors' permissions). Before, removing or restoring a permission did not revoke sessions or drop the cached authorization of users holding a child role. Legacy had the same gap. e2e `test/rbac-graph-reader.e2e-spec.ts`.
- **Tests:** authorization domain specs (50) and application specs (60). `application/__tests__/fakes/authorization.fakes.ts` has an in-memory RBAC store whose graph reads follow the Prisma reader's semantics, plus a rolling-back unit of work and the policy / support / catalog stores. Specs cover every command (RBAC, support access, policy plane four-eyes / staleness, catalog sync, purge), the after-commit handlers, and the queries with logic (decide, explain never lending SuperAdmin to another user, preview / validate). New e2e `test/support-access.e2e-spec.ts`.
- **Next:** see §0.6.

### 0.6 Step 4, claims part (session 3)

- **The claims context is live** (`src/contexts/claims/`, `claims.module.ts`, a composition module mounted by `app.module.ts`):
  - Infrastructure:
    - `persistence/`: the claim repository (compare-and-set on the loaded status, plus the expiry when `mustBeLiveAt`), the OTP repository, the reward inbox, the in-transaction claim view, the read repositories (via `PrismaReadExecutor`, under the caller's RLS session), the list queries / row mappers, `ClaimsScopeFactory` and `createClaimsTransactionalPorts`.
    - `adapters/`: the codes adapter (keyed hashes via `RewardCodeHasher`, SHA-256 OTP), the claimant adapter over identity's new `ConsumerClaimantPort` and the attribution adapter over referrals' new `RewardReferralAttributionPort`.
    - `outbox/`: `ClaimExpired` → `reward.platform` `reward.claim_expired`, the legacy payload.
    - `queue/` and `presentation/jobs/`: the expiry jobs through `SystemCommandDispatcher`, with the same scheduler ids.
    - `ClaimsRegistrations`: the in-transaction notice handlers and the mapper.
  - Presentation: `ConsumerClaimsController` serves `POST /claims/otp`, `POST /claims`, `GET /claims`, `GET /claims/:claimId` (new, `claims.get`) and `POST /claims/:claimId/qr` (now a POST, `claims.qr`). `RewardNotificationsController` serves the inbox. Every legacy decorator was kept.
  - `public-api.ts`: `createClaimsTransactionalPorts` (`ClaimRedemptionPort`, for pos in step 5).
- **Restored regression:** owners got no "reward approved / rejected / auto-published" inbox notice after the migration (legacy `RewardsAdminService` wrote it; the new review handlers didn't). Claims' `RecordOwnerNoticesOnRewardReview` is now registered. e2e `test/reward-review-notices.e2e-spec.ts`.
- **Cross-context ports added:**
  - identity `ConsumerClaimantPort` (`findClaimant(userId, { lock })`, `markPhoneVerified`). It replaced the unused `ConsumerPhoneVerificationPort`, under `createIdentityTransactionalPorts(...).consumerClaimants`.
  - referrals `RewardReferralAttributionPort` (`createReferralsTransactionalPorts(db).rewardReferralAttribution`).
  - `platform/infrastructure/crypto/reward-code-hasher.provider.ts` (shared `RewardCodeHasher` provider).
- **Deleted from `rewards/runtime`:** the consumer claims and reward-notification controllers, `RewardOtpService`, `RewardNotificationService`, `RewardLegalService`, the runtime `RewardRepository`, the OTP / notification / user / legal-acceptance repositories, the claim-expiry processors and `MerchantRewardService.expire*`, and `RewardClaimRepository`'s create / list / expiry methods. `ClaimService` is down to `findMerchantClaim` (TRANSITIONAL, for the legacy POS checkout until step 5).
- **Tests:**
  - Claims unit specs: domain (11) and application (27), using `application/__tests__/fakes/claims.fakes.ts` with a rolling-back unit of work. Infrastructure: the codes adapter, the mapper and the processors.
  - e2e: `consumer-claims` (HTTP: claim, list / detail, QR rotation, another customer's 404, OTP required and wrong attempt, the inbox), `claims-expiry`, `reward-review-notices`, plus `reward-claim-reservation`, rewritten against `ClaimRewardCommand` (parallel claims: never over `maxUsePerUser`, never oversold). `access-hardening` uses `POST …/qr`.
  - `app.e2e` and `openapi-document` pass now. `openapi-artifact` needs `pnpm openapi:export` (do it last).
- **Plan race tests (D01–D10), all e2e on a real database:**
  - `rewards-races`:
    - D01: approve vs reject; exactly one wins, and only its outbox event is recorded.
    - D03: revise vs approve; every reported success is in the stored row.
    - D04: double submit for review.
    - D10: auto-publish never overwrites a rejection, sequential and raced.
  - `reward-create-atomicity` (D02): a failing referrer insert leaves no reward behind.
  - `consumer-claims`:
    - D07: the old GET is 404, and a rotated-out backup code no longer finds the claim.
    - D09: ten concurrent wrong OTPs spend exactly 5 attempts.
  - `reward-claim-reservation` (D08).
  - Each race spec was run several times; they're stable.
- **D09 in code:** `PrismaOtpChallengeRepository.recordAttempt` is now a compare-and-set (`consumed_at IS NULL AND attempts = loaded AND attempts < MAX`; zero rows → `OtpAttemptsExhaustedError`), on top of the claimant row lock.
- **Verified as already done in rewards:** organizations' `MERCHANT_ACCESS` everywhere (no temporary token), the `ORGANIZATION_LOGO_ASSETS_SELECT` import gone, the approve / reject / auto-publish outbox mapper, auto-publish compare-and-set on `autoPublishAt <= now`, parent + referrer written in one repository write, and the reject reason required by the schema.
- **Still open in step 4:** the rows `rewards/runtime` still writes directly. `reward-sale.repository` (POS checkout) and `reward-referral.repository` (referral credit) belong to steps 5–6, and so does emptying `rewards/runtime` except POS and the referral code.


### 0.7 Where session 3 stopped (superseded by §0.8)

- **Root gate (last full run):**
  - `pnpm run lint` exit 0.
  - `pnpm run test`: every package green (API 3529 tests). The only failure is `@workspace/docs` `api-reference.artifact.test` (10 tests), because the generated API reference is stale. Fix with `pnpm openapi:export` (API e2e `openapi-artifact`, against a `ddd_*` clone) and then `pnpm docs:api` once the routes settle.
  - Full API e2e: 460/461; the only failure is `openapi-artifact`, same cause.
- **Step 5 (pos) has just started.** Only the domain exists so far, in `src/contexts/pos/domain/`: errors, `redemption-eligibility.policy`, the `SaleCheckedOut` event and the `RewardSale` aggregate. It has no specs yet; it typechecks but hasn't been linted.
- **POS design decisions:**
  - The four invalid reasons go through `RedemptionRefusedError(reason)`. The application layer maps them to an `AppError` with the legacy code and status (`ALREADY_REDEEMED` 409; `CLAIM_EXPIRED`, `REWARD_NOT_VALID_AT_STORE` and `STORE_REQUIRED` 422), because `CLAIM_EXPIRED` is 400 in the claims registry.
  - Map `CheckoutIdempotencyKeyReusedError` to the legacy `IDEMPOTENCY_KEY_REUSED` (409) the same way.
  - The other POS codes go into `DomainErrorCodeSchema` / `DOMAIN_ERROR_HTTP_STATUS`: `REDEMPTION_TOKEN_INVALID` 404, `REDEMPTION_INPUT_REQUIRED` / `DUPLICATE_REWARD_CODE` / `MULTIPLE_CUSTOMERS` / `MIN_SPEND_NOT_MET` 422, `POS_CODE_LOCKED` 429. Error details must carry `claimId`, `minSpendMinor` and `lockedUntil`.
- **Next for POS:**
  1. `PosScope`: sales, terminals, API keys and lockout; claims' `createClaimsTransactionalPorts(db, hasher).redemption`; rewards' `inventory.recordRedemption` (replaces the legacy direct `reward.update`) and `audit`; referrals' credit and `signupSuccess`; organizations' `merchantPosSettings`.
  2. `ValidateRedemptionCodes` and `CheckoutSale` (replay by idempotency key first; unknown backup codes counted in their own commit before failing; one unit of work).
  3. Referral credit (step 6 port; legacy `reward-referral.repository.creditReferrerForRedemption` touches referrals, the rewards pool / stock and the referrer claim).
  4. Terminals and pairing (D33: lock on issue), API keys (D34: compare-and-set revoke), the guards.
  5. Delete `rewards/runtime` POS code. Existing e2e is the safety net: `pos-checkout`, `pos-terminals`, `store-closure`, `api-key-rls-principal`, `merchant-location-scope`, `organization-terminal-unique`.

### 0.8 Session 4: step 5 (pos) done, plus the reward-referral half of step 6 (resume here)

- **`rewards/runtime/` and `pos/api-keys/` are deleted.** Both folders were untracked; a tarball of them is in the session's job directory (`~/.claude/jobs/56ca22bd/tmp/deleted-legacy/`), and the tag `ddd-composer-snapshot` holds Composer's older copy. `app.module.ts` mounts `PosModule` (composition) and `PosAccessModule` (global leaf) instead of `RewardsRuntimeModule` / `ApiKeysModule`.
- **pos** (`src/contexts/pos/`), full layout:
  - Domain: `RewardSale` (checkout rules), `OrganizationTerminal`, `OrganizationApiKey` (D34 idempotent revoke), policies (redemption eligibility, backup-code lockout, terminal status, API-key scope capabilities), `SaleCheckedOut`, the error codes (registered in `DomainErrorCodeSchema` / `DOMAIN_ERROR_HTTP_STATUS`).
  - Commands: `ValidateRedemptionCodes`, `CheckoutSale`, `RegisterTerminal`, `IssuePairingCode` (D33 row lock), `RemoveTerminal`, `PairTerminal` (`pos.terminal.pair`), `ChangePosSettings`, `IssueApiKey`, `RevokeApiKey` (D34 CAS). Queries: `ListTerminals`, `GetTerminalSummary`, `GetTerminal`, `GetPosSettings`, `ListApiKeys`, `ListOrganizationRedemptions`.
  - Checkout is ONE unit of work under the till key's `api_key` RLS principal: claims' `ClaimRedemptionPort` (CAS in claim-id order), then every reward the sale can touch, the redeemed rewards AND their referrer children, locked in ONE id-ordered pass (`RewardInventoryPort.lockForCheckout`, §0.9), then `recordRedemption`, the sale + redemption rows, the `merchant.checkout` audit row, referrals' credit + signup stamp, and `SaleCheckedOut` → outbox `merchant.redeem_reward`. Replay first; a lost race (unique key or claim CAS) replays the winner, answers `ALREADY_REDEEMED`, or (a winner the caller's store cannot read) answers 409 `IDEMPOTENCY_KEY_REUSED` without a sale id. Unknown backup codes are counted and committed before the request fails.
  - `RedemptionRefusedError` / `CheckoutIdempotencyKeyReusedError` are re-coded to the legacy wire codes (`ALREADY_REDEEMED` 409, `CLAIM_EXPIRED` / `REWARD_NOT_VALID_AT_STORE` / `STORE_REQUIRED` 422, `IDEMPOTENCY_KEY_REUSED` 409) in `application/errors/pos-refusal.errors.ts`.
  - Member handlers bind the actor to the verified organization (`actingInOrganization`, as organizations does) before the unit of work; without it RLS refuses the writes.
- **Security kit** (platform): `ApiKeyVerificationPort` / `API_KEY_VERIFICATION` and `TillResolverPort` / `TILL_RESOLVER` (pos implements both in `PosAccessModule`); `MerchantApiKeyGuard` moved to `platform/presentation/http/security/guards/` (same name: the docs API-reference generator keys on it) with `@TillPoint()`; the request helpers and `MerchantActor` live in `security/api-keys/`; `MerchantActorInterceptor` resolves members through organizations' new `MERCHANT_ORGANIZATION_RESOLVER`.
- **organizations**: no pos import. It consumes `API_KEY_CAPABILITIES` and `STORE_CLOSURE_FACTORY` by token (both transitional adapters deleted); its transactional `MerchantPosSettingsPort` gained `tillOrganization` and `storeNames`; `isOrganizationOperating` is an organizations domain policy.
- **Referral credit** (step 6, reward-referral half):
  - referrals: `RewardReferral` aggregate, `ReferralCreditPort` via `createReferralCreditPort(db, events, bonusStock)` (locks the referral, takes the bonus, records `ReferrerCredited`; stamps the signup referral and records `SignupReferralSucceeded`). The transitional `SIGNUP_REFERRAL_SUCCESS` port is gone; the notice is delivered after commit by claims (§0.9: `DeliverSignupSuccessNoticeOnSignupReferralSucceeded`, sweeper `SweepSignupSuccessNotices`).
  - rewards: `Reward.creditReferral` (pool −1, referrer child stock held) with the pool and child counters persisted as increments; `getForReferralCredit` locks parent then child (inside a checkout both are already held from `lockForCheckout`). `RewardRedemptionFactsPort.titlesOf` (batched).
  - claims: the credit claim and inbox notice are issued in the checkout transaction (`IssueReferrerCreditClaimOnReferrerCredited`, `RecordNotificationOnReferrerCredited`); the email is requested after commit (`RequestReferrerCreditEmailOnReferrerCredited`) through `EmailRequestPort` in ONE transaction with `credit_notified_at` (decision #44), with the `rewardsReferralCreditNotify` BullMQ sweeper (`SweepReferrerCreditEmails`, same scheduler id).
  - **Deviation from plan §7.4 (recorded in `context-map.md`):** the referrer-credit email lives in claims, not referrals. Referrals cannot read the referrer's address (identity already depends on referrals); claims already depends on identity, referrals and notifications.
  - Claims' in-transaction `RecordNotificationOnSignupReferralSucceeded` was removed (and its one test case): under the till key's RLS it could neither read the referee's name nor insert into the referrer's inbox. Its behaviour is covered by the after-commit delivery and its specs.
- **Shared code moved, not duplicated:** `minorUnitsToNumber` → `platform/infrastructure/persistence/minor-units.ts` (reporting and pos); `unambiguousCode` → `platform/infrastructure/crypto/unambiguous-code.ts` (claims and pos).
- **Verified:** API typecheck, lint and unit tests green (3573). Root `pnpm run lint` exit 0. Full API e2e 467/468: only `openapi-artifact`. The POS safety net (`pos-checkout`, `pos-terminals`, `store-closure`, `api-key-rls-principal`, `merchant-location-scope`, `organization-terminal-unique`) passes with assertions unchanged (`pos-checkout` changed one import path). Root `pnpm run test`: only `@workspace/docs` `api-reference.artifact.test` (11): the stale generated artifact (it still names session 3's `ConsumerClaimsController_getClaimQr` / `getAnalytics*`). Fix: `pnpm --filter @workspace/api openapi:export` (e2e `openapi-artifact`, against a `ddd_*` clone), then `pnpm docs:api`.
- **Follow-ups:**
  - Decision still open: count wrong backup codes against the sign-in challenge (§0.4).
  - Decision still open: regenerate the OpenAPI artifact and the API reference now or at the end.
  - After-commit handlers run asynchronously (`AfterCommitPublisher` does not await them). `pos-checkout` now waits for `credit_notified_at` with a deadline instead of reading it once (§0.9).
  - pos read models join store names and reward titles across contexts (claims' read models already do); plan §6.2 forbids it strictly, so decide whether read-side joins are allowed.
  - Referrals wrote claims' `reward_notifications`, read `users.fullName`, and wrote rewards' `reward_audit_logs` directly. Fixed in §0.9.
- **Next:** handoff §2 step 7 (the `/auth/signup-referrals` e2e is done, §0.9).

### 0.9 Session 5: review of steps 5–6 against the plan, and the fixes

A review compared pos and the referral credit with the deleted legacy code and plan §7.3 / §7.4 / §13. Fixed, each with tests:

- **Cross-store idempotency key (was a 500).** The `(organization_id, idempotency_key)` index is organization-wide, but a store-limited key cannot read another store's sale, so there was no winner to replay. Now 409 `IDEMPOTENCY_KEY_REUSED` with no sale id (`idempotencyKeyTakenElsewhere`). Unit test plus a `pos-checkout` e2e case.
- **Lock-order deadlock between overlapping checkouts.** The referrer child used to be locked after the sorted pass. `RewardInventoryPort.lockForCheckout(rewardIds)` locks every line reward and its referrer child in one `ORDER BY id FOR UPDATE` statement, after the claims and before any reward write. The old "no lock-order deadlock" claim in §0.8 was wrong; it is corrected there.
- **Referrer-credit sweeper.**
  - `invalid-props` is permanent: the referral is marked and logged `undeliverable`, never retried.
  - The run pages by keyset `(credited_at, id)`, at most 20 pages of 50, so failures never block the rows behind them.
  - Only transient failures are rethrown.
  - The result splits `alreadyRequested` and `failed` out of `skipped`.
- **Signup-referral jobs** rethrow `SignupReferralJobItemsFailedError` at the end of a run with failures, so the dispatcher audits it as failed. The cron runs both jobs even when the first fails.
- **Deleted rewards:** `RewardRedemptionFactsPort.factsFor` filters `is_deleted`, so validate and checkout both answer a deleted reward's code as unknown.
- **`ClaimRedeemed`** is now collected. `createClaimsTransactionalPorts(db, codeHasher, events)` takes the caller's collector.
- **RegisterTerminal vs store closure:** registration locks the store `FOR SHARE` (`MerchantPosSettingsPort.lockOpenStore`) and refuses a closed store with 409 `TERMINAL_STORE_NOT_ACTIVE` (new code). A closure either committed first, or waits and then removes the new till with the store's others.
- **Clock:** `PrismaApiKeyVerifier` and `setRequireRegisteredTerminals` take the clock instead of calling `Date.now()`.
- **Smaller fixes:**
  - `RedemptionCodeResolver` is injected, not created with `new`.
  - `actingInOrganization` lives once, in `platform/application/actor-context.ts`.
  - A member's malformed `:orgSlug` reaches the route's 400 pipe again instead of a 404 from the interceptor.
  - `attachReferee` is a compare-and-set that never takes over another referee's referral.
- **Tests added:**
  - Controller metadata specs for every pos controller and `SignupReferralController` (`test/support/route-metadata.ts`).
  - Repository and adapter specs: sale, terminal, API key, store closure, till terminals, capabilities, read repositories, organizations' POS settings, reward `lockForCheckout` with the referral-credit CAS and non-negative guards, and the referral repository.
  - Handler specs: list keys, list redemptions, terminal summary, dashboard, referees, and the signup cron.
  - Handler cases: rollback after a partial write, CAS loss, auth denied with nothing saved, cross-tenant ids, a lost race with another hash, the hidden winner, corrupt data, and lockout through validate.
  - Domain cases at now±1 ms.
  - Stronger fakes: rollback record, reserved units, a credit path the tests can drive, a store-aware `FakeMerchantAccessPort`, and PENDING-only referrals.
  - e2e:
    - `pos-terminals-race` (D33).
    - `n-plus-one-redemptions`.
    - `signup-referrals`.
    - `pos-checkout`: bonus counters, credit-claim expiry, inbox and email rows, the cross-store key, and sweeper recovery; `credit_notified_at` is now polled.
- **Recorded deviations from the plan:**
  - The referrer-credit email and the signup-success notice are requested after commit, not "during checkout" (plan §7.4). The till's `api_key` principal can read neither the referrer's address nor the referee's name, and cannot write the referrer's inbox. Durability holds: the "owed" state (`credit_notified_at` / `success_notified_at` NULL) commits with the credit, and the BullMQ sweepers retry it. The sweepers run only where BullMQ runs (Redis on).
  - Plan §7.3's `ApiKeyLockout` aggregate is a policy (`code-lockout.policy.ts`) plus `CodeLockoutRepository`: the lockout is two counters updated by conditional statements, with no invariants that need loading. The command is `ValidateRedemptionCodes` (one code per call, as the route takes), not `ValidateRedemptionCodes`.
  - `touchLastUsed` (`lastUsedAt`) is written before the request proceeds, not fire-and-forget: it must run inside the guard's system-operation RLS scope, which ends when `verify` returns. The old code also awaited it.
  - `ReferralSummaryReadPort` was folded into `SignupReferralPort.summariesForReferees` (one port for the admin user list's batched read).
  - `merchant.redeem_reward.claimIds` is in claim-id order (deterministic). The old code used redemption-id order, which is random UUID order; consumers never depended on it.
  - Request-driven system operations use the operation name as the audit reason (platform convention), so the pairing reason text differs from the old one.
  - `PrismaApiKeyVerifier` builds organizations' ports on the raw `PrismaService`: it runs in the guard's own system-operation scope, before any unit of work exists.
- **Table ownership restored (plan §6.2).** Referrals used to write claims' inbox and rewards' audit log, and read identity's `users`. It cannot import either context: organizations imports identity, identity imports referrals, and rewards imports organizations, so either import would be a cycle. Decided with the user and implemented, adding no import edges:
  - **The signup-success notice is delivered by claims**, the same pattern as the referrer-credit email.
    - Referrals publishes the bookkeeping on `success_notified_at` as `SignupSuccessNoticesPort` (`listOwed` by keyset, `claim` as a compare-and-set) through `createReferralsTransactionalPorts`, plus the `SignupReferralSucceeded` event.
    - Claims' `SignupSuccessNoticeApplicationService` claims the notice and writes its own inbox in one `auth.signup_referrals.notify_success` transaction. That is the same operation name, so the RLS allowlist is unchanged.
    - The referee's name comes through identity's new `ConsumerClaimantPort.displayName`.
    - Delivery runs after commit (`DeliverSignupSuccessNoticeOnSignupReferralSucceeded`), with the hourly `SignupSuccessNoticesCron` → `SweepSignupSuccessNotices` as the backlog sweeper.
    - Referrals' delivery adapter, handler, command and token are deleted, and its cron now runs only the code job.
  - **The code job's audit row is written by rewards, received by token** (dependency inversion, like `STORE_CLOSURE_FACTORY`).
    - Referrals declares `SignupReferralAuditPort` and `SIGNUP_REFERRAL_AUDIT_FACTORY`.
    - The new global leaf `RewardsAccessModule` provides it with rewards' own `PrismaRewardAuditWriter`, in the code job's transaction.
    - The action and metadata (`signup_referral.code_issued`) are unchanged.
  - Referrals imports no context and writes only its own tables. Rewards → referrals (token and types) and claims → identity / referrals already pointed the right way.
  - Tests:
    - Claims: the service, sweeper, after-commit handler and cron.
    - Referrals: the notices port and the code job's audit through the factory.
    - Rewards: the adapter, and the module's global provision.
    - Identity: `displayName` (e2e).
    - `signup-referrals` e2e: the sweeper delivers an owed notice once.
- **Open decision:** pos read models join store names and reward titles across contexts (§0.8).

## 1. Current state

- **Branch:** `refactor/ddd-cqrs`. **Nothing is committed.** Roughly 1,800 changed paths sit in the working tree.
- **Composer's state** before this pass is preserved as a dangling commit, **`a0387300d85ffd9b737bf09a6585398c7d991c6f`**. Diff against it with `git diff -M a0387300d -- <path>`. Tag it before anything garbage-collects it: `git tag ddd-composer-snapshot a0387300d`.
- **The last full gate run was on Composer's state:** lint, typecheck and unit tests green. e2e 60/61, and the one failure (`admin-reward-detail`) is drift in the dev database: a seeded reward was published on 2026-10-15. The test passes on a reseeded copy.
- **The current tree has NOT been gated.** 11 implementation agents were stopped mid-edit, so expect typecheck and lint failures in half-finished areas. **First step on resume:** run `pnpm run typecheck` and `pnpm run lint` and triage.
- **Databases:** never run e2e against the `.env` database. It holds the owner's real data, including a real GitHub link.
  - `ddd_e2e_template` is a clone of the dev database, reseeded.
  - Per-agent clones: `ddd_b1` … `ddd_b6`, `ddd_f1`, `ddd_p0`.
  - Run e2e as `DATABASE_URL='postgresql://postgres:postgres@localhost:5432/<db>?schema=public' pnpm --filter @workspace/api exec vitest run --config vitest.config.e2e.ts <files>`.
  - Drop the clones when you're finished.

### 1.1 API contexts (`apps/api/src/contexts/`)

| Context | State |
|---|---|
| catalog | §4.2 layout done (Composer). Small issue: `resource-list-translators.list-query.spec.ts` sits at the context root; move it into `__tests__/`. |
| audit, reference-data, integrations-github | Layout done. Agent was stopped before its final verification. **Verify:** existing e2e, the new geo unit tests, the GitHub ACL. |
| authorization | Layout done (`application/domain/infrastructure/presentation/public-api`). Stopped while rewriting the Cedar files and applying `adminSecurityMutation`. **Verify and finish.** |
| organizations | Layout done. `public-api.ts` exports `MERCHANT_ACCESS`, `ORGANIZATION_READ` (batched `getDisplayData`, `listOwnerUserIds`), `createOrganizationsTransactionalPorts`, `ORGANIZATION_AUDIT` and its error codes. KYB and onboarding have moved in from rewards. Stopped while cleaning up `rewards/runtime` (`RewardsAdminService`, mappers). **Verify that the admin reward review endpoints still exist** (pending list, get, images download/archive, approve, reject). |
| files, notifications | Layout done. Durable email (ADR 060) is being implemented for real: the `notification.email.requested` exports exist in `packages/shared/src/schemas/infrastructure/outbox.ts`. Stopped while rewriting the notification controller specs. **Verify** that the transactional `EmailRequestPort`, the dispatcher route to the BullMQ `emailSend` queue, `FileVerdictReached` through the dispatcher, and `FileDeleted` as a real M2 event are all complete. |
| reporting | Layout and module done. Its sub-agent stopped; `apps/analytics-consumer` reorganisation is unverified. |
| identity | **Partial.** The new layers exist, but the legacy `auth/`, `sessions/` and `impersonation/` holding folders remain. Stopped while moving the security-kit files. |
| rewards | Layout done; `runtime/` deleted in session 4 (§0.8). |
| claims | Done in session 3 (§0.6); referrer credit claim and email added in session 4 (§0.8). |
| pos | Done in session 4 (§0.8). |
| referrals | Signup half done (§0.3); reward-referral credit done in session 4 (§0.8). |

### 1.2 Platform (`apps/api/src/platform/`)

The PL agent was stopped before it reported, so **the status of each item below is unknown; verify each one.**

- **CRITICAL:** the global `ThrottlerGuard` probably resolves the notifications webhook `ThrottlerModule`'s options. Fix it by registering one `ThrottlerModule` with named throttlers (`strict`, `default`, `webhook`, `preAuth`), and prove it with `test/rate-limit-wiring.e2e-spec.ts`: login gets 429 at limit + 1.
- **Tracker:** choose it per throttler. `strict` and `preAuth` key on IP; the others key on the principal.
- **Redis throttler storage:** add a DI test.
- **ADR 061 exists.** Verify the implementation behind decision #71: advisory-lock wait, no polling, takeover when the original fails, a 5 s cap, and a stale `docs/generated/openapi.json` text regenerated by its script.
- **Decision #72:** a `preAuth` IP throttler placed before `AuthGuard` in `APP_GUARD_ORDER`.
- **Decision #73:** policies `adminSecurityMutation` (10/min per principal) and `sessionRefresh` (10/min per IP).
- **Remaining platform review findings:**
  - Two CQRS module instances (`system-command.module.ts` imports the static `CqrsModule`).
  - `SystemCommandDispatcher` throws when the audit write fails after the command succeeded.
  - The system-command audit row has `actorUserId` null and a random `correlationId`.
  - `ActorContextFactory` ignores `@RlsBypass` and the refresh-token subject.
  - `withRlsContext` doesn't fail closed, doesn't set `app.policy_version`, and issues 9 `set_config` round trips.
  - A 5xx `DomainError` leaks details.
  - `AppErrorHttpStatus` was widened to `number`.
  - `DbClient = object`.
  - Dead `finish-unit-of-work.ts`.
  - `InTransactionEventRegistry.snapshot()` returns a mutable array.
  - `systemActor(string, string)`.
  - A mutable singleton `ActorContextFactoryHost`.
  - Colocated specs that belong in `__tests__/`.
  - Missing §13.3 fakes.

### 1.3 Frontend and shared

- **`packages/shared` (done):** the T29 split into `src/contexts/<ctx>/{contract,routes,schemas}` keeps every public name identical. `claims.qr` is now POST and `claims.get` (`GET /claims/:claimId`) is new.
  - `AdminRejectRewardSchema.reason` is **required** (decision #74), and the admin dialog requires it.
  - **Pending:** the export-name snapshot in `contracts/__tests__/api-contract-shape.test.ts` fails, because it doesn't yet list the four new `NOTIFICATION_EMAIL_*` / `NotificationEmailRequested*` exports. Update it with `vitest -u` **only after** confirming those are the only diff.
- **`packages/api-client` and the web QR flow (done):** an SSR `claims.get`, a client `qr` mutation, StrictMode-safe, with tests. Mobile has no `claims.qr` caller.
- **`packages/client` + `packages/ui` (F2, stopped mid-task):**
  - `lib/contexts/` exists.
  - **Verify:** the regroup, the export aliases, the `CLIENT_ONLY_WIDGETS` allowlist and its lint rule, the `*.client-only.tsx` wrappers, and `LazyMotion`.
- **Mobile (F6, stopped mid-task):**
  - `src/contexts/{identity,pos,integrations-github,reporting}` exist.
  - **Verify:** the moves, `asyncRoutes: "development"` on the `expo-router` plugin in `app.config.ts`, `inlineRequires: true` in `metro.config.js`, and the `React.lazy` screens.
  - Make sure no move script was left inside the repo.
- **web, admin and merchant regroup (T31–T33): not started.**

### 1.4 Tooling and performance (P0, done)

- **Built:**
  - `pnpm dev:timing` (`packages/tooling/src/dev-timing/`)
  - a watch runner plus `dev` scripts for `shared`, `messaging` and `api-client`
  - `pnpm bundle:check [--write-baseline]` (`packages/tooling/src/bundle-budget/`, reads the `.next` manifests and the `expo export` metadata)
  - `turbo.json` concurrency raised to 16
  - docs `--force` dropped
  - a rspack `WatchWorkspaceDistPlugin` that restarts the API when a package's `dist/` changes (pinned by `scripts/__tests__/dev-script-runtime.spec.ts`)
    — superseded 2026-10-24: the dev bundle now reads `@workspace/*` from their TypeScript source (`development` condition, bundled; `apps/api/turbo.json` drops `^build` from `dev`), so the API starts without waiting on `tsc` builds of `shared` and `messaging`, and an edit there rebuilds the API directly
- **Baseline (snapshot, medians, ms):**

  | Run | A (all apps up) | B (API ready) | C (first page: web / admin / merchant) | D (Metro, iOS) |
  |---|---|---|---|---|
  | Warm | 30,197 | 7,291 | 577 / 1,072 / 1,538 | 1,158 |
  | Cold | 46,313 | 9,835 | 2,681 / 13,722 / 10,138 | 11,338 |

- **Targets** (decision #54): each phase at least 40% faster than its warm median, and B ≤ 5,000 ms warm.

## 2. Pending tasks, in order

1. **Gate triage:** `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`. Fix breakage left by the stopped agents.
2. **Finish identity** (§7.6, D12–D20, D35, D36): remove `auth/`, `sessions/` and `impersonation/`; expose `IdentitySessionsPort`, `AccountProvisioningPort` and `ConsumerPhoneVerificationPort`; swap the transitional adapters (`*.transitional-adapter.ts`) in authorization and organizations; apply `sessionRefresh`; keep only one `@RateLimit` on impersonate.
3. **Finish authorization** (§7.7, D21–D23, D37): Cedar files, `RbacMutationScope` with `IdentitySessionsPort` in the same transaction, `adminSecurityMutation` on every mutation (one decorator each), bootstrap sync as awaited, locked system commands.
4. **Finish rewards and claims** (§7.1–7.2, D01–D04, D07–D10):
   - Every live path uses the `Reward` aggregate with compare-and-set on `concurrencyToken`.
   - Outbox `reward.approved` / `reward.rejected`.
   - Auto-publish compare-and-set also checks `autoPublishAt <= now`.
   - One transaction for parent + referrer revise.
   - Reject reason required.
   - `ClaimRedemptionPort`, `RewardInventoryPort`, `RewardAuditPort`.
   - Switch to organizations' `MERCHANT_ACCESS` / `ORGANIZATION_READ` and delete rewards' temporary `MERCHANT_ACCESS`.
   - Drop the `ORGANIZATION_LOGO_ASSETS_SELECT` import.
   - The `claims.qr` POST / `claims.get` handlers.
   - Race e2e tests.
   - Empty `rewards/runtime/` except the POS and referral code.
5. **Build pos** (§7.3, D33, D34): checkout as one UnitOfWork over the claims, rewards and referrals ports; terminals and pairing; API keys plus `ApiKeyVerificationPort` for the guards; `StoreClosurePort` (replaces organizations' transitional adapter); delete `pos/api-keys/`.
6. **Build referrals** (§7.4): move `identity/auth/signup-referrals`; `ReferralCreditPort`, `SignupReferralPort`, the sweeper jobs through `SystemCommandDispatcher`, durable emails.
7. **Verify files, notifications, audit, reference-data, integrations-github and reporting** against their existing e2e files (unchanged assertions) and the plan rows; finish the analytics-consumer reorganisation.
8. **Platform items** in §1.2 (verify or finish).
9. **Delete every `*.transitional-*` adapter**, plus `LegacyBindingAdapter` once the owners register real guards. `rg -n "transitional|legacy" apps/api/src/contexts` must return nothing.
10. **Phase D:**
    - Add policies `emailSendingPublic` (3/min), `emailSendingAuthenticated` (10/min) and `publicRead`. Apply them to `/claims/otp`, the invite endpoints and the public reward reads.
    - Replace merchant `@SkipAuthThrottle` with `authenticatedMutation`.
    - A 429 e2e test per policy.
    - A Reflector-based coverage test that excludes comments and requires a reason for every skip.
    - N+1 tests (`expectNoNPlusOne`) for every list endpoint marked in §7.
11. **Lint hardening:**
    - Widen the cross-context and platform rules in `packages/eslint-config/import-boundaries.js` to `contexts/<other>/(?!public-api)`, so `runtime/`, `auth/` and `rbac/` are covered.
    - Build per-context blocks for the frontend rule.
    - Add the missing §12.1 fixtures.
    - Route the roughly 40 platform → context-internal imports through `public-api.ts`.
12. **Revert forbidden or odd changes:**
    - Remove `"scripts/**/*.mjs"` from `apps/api/eslint.config.js` `ignores` (`eslint-rules/**` was already there) and delete Composer's throwaway codemods in `apps/api/scripts/*.mjs`.
    - Make `test/support/__tests__/sql-statement-counter.spec.ts` an e2e spec without `context.skip`.
    - Restore the no-body case in `test/support/fastify-request.ts` and its http-audit assertions.
    - Re-cover the deleted `BaseService` 404 write-path cases in catalog, and assert `deletedInTransaction`.
    - Derive the rate-limit numbers in `apps/docs/src/lib/api-reference/endpoint-access.ts` from the policy source.
    - Regenerate `apps/mobile/uniwind-types.d.ts` (it was hand-edited).
13. **web, admin and merchant regroup** (T31–T33, §14.3). Switch the chart and cropper call sites to the `*.client-only.tsx` wrappers; every page stays SSR.
14. **API boot** (T42, §19.3, decisions #62/#68 — no caches):
    - Register schedulers through `MaintenanceSchedulerRegistry` with `Promise.all` and a 10 s timeout.
    - Add the `useBullMq` guard in `storage-queue`.
    - Load the report fonts on each export, with no cache.
    - Build Swagger on each request.
    - Load Cedar WASM on first use, behind one in-flight promise.
15. **Bundle budgets** (T45): after step 13, `pnpm turbo run build --filter=@workspace/web --filter=@workspace/admin --filter=@workspace/merchant --filter=@workspace/mobile && pnpm bundle:check --write-baseline`, commit `bundle-budgets.json`, and add a `pnpm bundle:check` CI step.
16. **T46:** re-run `pnpm dev:timing` (3× cold, 3× warm) and compare with §1.4. Record the targets and results in `rules/19`.
17. **Docs:**
    - Real front matter on `ddd-cqrs-spec.md`, `ddd-cqrs-migration-plan.md` and `ddd-cqrs-migration-gaps.md` (all three currently carry ADR 001's).
    - ADR 059: lazy boot as actually implemented, plus the uncached-fonts trade-off.
    - ADR 058 and rules/01: lint enforcement as it really is.
    - `context-map.md`: 14 contexts; make the table and the diagram agree.
    - Gaps file: remove the duplicate bullet.
    - `tenancy-and-rls.md` §3.1: the new system operations (`catalog.product_catalog.*`, `files.delete`, and any new ones).
    - Move the plan §5.4 discovery into the gaps file.
    - Old `src/modules/` paths in `docs/technical/**` and ADRs 008/011/025/051.
18. **Final verification (T49):** from a clean install, `pnpm run lint`, `typecheck`, `test`, `test:e2e` (against a reseeded clone), `db:check-rls-manifest`, every app build, and `bundle:check`. Compare with the baseline.
19. **Code review report to the owner.** Composer's snapshot findings from the four review passes:
    - Critical throttler wiring.
    - Only D28, D29 and D32 of 27 defects were actually fixed.
    - The `Reward` aggregate is unused.
    - ADR 060 was claimed but not implemented.
    - The idempotency polling.
    - Lint boundary holes.
    - A forbidden ESLint `ignores` entry.
    - A self-skipping test.
    - Wrong front matter.
    
    The full list is in §1.2 and steps 10–12 above.

## 3. How to resume cheaply

Token cost is driven by running many parallel agents on large contexts.

- Resume **one context at a time** with **one agent**, in the order of §2, and run the gate between contexts.
- Don't re-run the full review; its findings are captured here.
- Prefer scoped commands:
  - `pnpm --filter @workspace/api exec vitest run --config vitest.config.unit.ts src/contexts/<ctx>`
  - `pnpm --filter @workspace/api exec eslint --max-warnings=0 src/contexts/<ctx>`
- Run the full gate only at checkpoints.
