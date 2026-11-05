// ============================================
// prisma/unique-on-soft-delete.ts — reviewed full uniques on soft-deletable models (enhancement 2.8)
// ============================================
// A soft-deleted row keeps its values, so a plain `@unique` on a soft-deletable model means a deleted row
// still blocks the value (a deleted store's code can't be reused). Usually the right index is a partial one
// (`@@unique([...], where: { isDeleted: false })`, docs/technical/database.md). Every plain unique on a
// model with `isDeleted` must therefore be listed here with the reason it is intended; the unit spec
// (prisma/__tests__/unique-on-soft-delete.spec.ts) fails on an unlisted one, and on a stale entry.

/** Why a full unique is right on a soft-deletable model. */
export type FullUniqueReason =
	/** A random token, hash or generated sequence: never chosen by a person, never reused. */
	| "SECRET_OR_GENERATED"
	/** At most one row per owner (a user's avatar, a claim's redemption), deleted or not. */
	| "ONE_PER_OWNER"
	/** A join row between two records; restoring the link un-deletes the row. */
	| "JOIN_ROW"
	/** `(tenantId, id)`, so a composite foreign key can reference it. */
	| "TENANT_SCOPED_ID"
	/** A natural key that stays taken after deletion on purpose (history, idempotency, a code people saw). */
	| "NATURAL_KEY_KEPT";

/** `Model.field` or `Model.a,b,c` (a compound `@@unique`) → why it is a full unique. */
export const REVIEWED_FULL_UNIQUES: Readonly<Record<string, FullUniqueReason>> = {
	"PasswordResetToken.token": "SECRET_OR_GENERATED",
	"PasswordResetToken.tokenDigest": "SECRET_OR_GENERATED",
	"TwoFactorPendingSetup.userId": "ONE_PER_OWNER",
	"WebAuthnCredential.credentialId": "SECRET_OR_GENERATED",
	"UserAvatar.userId": "ONE_PER_OWNER",
	"UserAvatar.fileId": "ONE_PER_OWNER",
	"Permission.action,resource,scope": "NATURAL_KEY_KEPT",
	"CapabilityDefinition.slug": "NATURAL_KEY_KEPT",
	"CapabilityDefinition.permissionId": "ONE_PER_OWNER",
	"UserRole.userId,roleId": "JOIN_ROW",
	"RolePermission.roleId,permissionId": "JOIN_ROW",
	"Tenant.slug": "NATURAL_KEY_KEPT",
	"TenantSlugHistory.slug": "NATURAL_KEY_KEPT",
	"Location.tenantId,id": "TENANT_SCOPED_ID",
	"Membership.tenantId,id": "TENANT_SCOPED_ID",
	"TenantMerchantProfile.tenantId": "ONE_PER_OWNER",
	"TenantInvitation.tokenHash": "SECRET_OR_GENERATED",
	"TenantInvitationLocationScope.invitationId,locationId": "JOIN_ROW",
	"TenantPlacement.tenantId": "ONE_PER_OWNER",
	"TenantEncryptionKey.tenantId,keyVersion": "NATURAL_KEY_KEPT",
	"TenantAsset.tenantId,assetType": "NATURAL_KEY_KEPT",
	"FileVariant.fileId,kind": "JOIN_ROW",
	"Reward.tenantId,id": "TENANT_SCOPED_ID",
	"RewardLocationScope.rewardId,locationId": "JOIN_ROW",
	"RewardAudienceMember.rewardId,userId": "JOIN_ROW",
	"RewardClaim.redemptionTokenHash": "SECRET_OR_GENERATED",
	"RewardClaim.backupCodeHash": "SECRET_OR_GENERATED",
	"RewardReferral.attributionToken": "SECRET_OR_GENERATED",
	"SignupReferralCode.code": "NATURAL_KEY_KEPT",
	"SignupReferral.refereeUserId": "ONE_PER_OWNER",
	"TenantApiKey.keyHash": "SECRET_OR_GENERATED",
	"TenantApiKey.tenantId,id": "TENANT_SCOPED_ID",
	"TenantTerminal.apiKeyId": "ONE_PER_OWNER",
	"TenantTerminal.pairingCodeHash": "SECRET_OR_GENERATED",
	"TenantTerminal.tenantId,apiKeyId": "JOIN_ROW",
	"RewardRedemption.claimId": "ONE_PER_OWNER",
	"RewardSale.tenantId,idempotencyKey": "NATURAL_KEY_KEPT",
	"KanbanLevelCounter.level": "NATURAL_KEY_KEPT",
	"KanbanConversionStage.stage": "NATURAL_KEY_KEPT",
	"KanbanTask.key": "NATURAL_KEY_KEPT",
	"EmailDeliveryEvent.webhookId": "SECRET_OR_GENERATED",
	"GithubAccountLink.userId": "ONE_PER_OWNER",
	"GithubWebhookSubscription.owner,repository": "NATURAL_KEY_KEPT",
	"InboxDeadLetter.consumer,topic,partition,offset": "NATURAL_KEY_KEPT",
	"DataChangeLog.changeSequence": "SECRET_OR_GENERATED",
	"DataChangeGroup.groupKey": "SECRET_OR_GENERATED",
	"PlatformResourceIdempotencyRecord.scope,idempotencyKey": "NATURAL_KEY_KEPT",
	"OpsServer.agentTokenHash": "SECRET_OR_GENERATED",
	"OpsServerSample.serverId,resolution,bucketStart": "NATURAL_KEY_KEPT",
	"OpsInstanceSample.instanceId,resolution,bucketStart": "NATURAL_KEY_KEPT",
	"OpsDependencySample.dependency,resolution,bucketStart": "NATURAL_KEY_KEPT",
	"OpsSettings.key": "NATURAL_KEY_KEPT",
	"LoadTestPoint.runId,second": "NATURAL_KEY_KEPT",
	"LoadTestStepStat.runId,step": "NATURAL_KEY_KEPT",
	"Notification.recipientKey,typeKey,dedupeKey": "NATURAL_KEY_KEPT",
	"NotificationDelivery.notificationId,channel,pushDeviceId": "NATURAL_KEY_KEPT",
	// Enhancement 5.7: a provider's delivery id stays taken, so a replay is refused even after the record is deleted.
	"ReceivedWebhook.provider,providerDeliveryId": "NATURAL_KEY_KEPT",
	"WebhookEndpoint.tenantId,id": "TENANT_SCOPED_ID",
	"WebhookEvent.tenantId,id": "TENANT_SCOPED_ID",
	// One delivery per endpoint per event, whatever became of it: the retry worker's idempotency key.
	"WebhookDelivery.endpointId,eventId": "NATURAL_KEY_KEPT",
	"NotificationPreference.userId,tenantKey,category,channel": "NATURAL_KEY_KEPT",
	"NotificationSchedule.userId": "ONE_PER_OWNER",
	"TenantCustomer.tenantId,userId": "JOIN_ROW",
	"BroadcastReport.broadcastId,reporterUserId": "JOIN_ROW",
	"TenantBroadcastStrike.tenantId,broadcastId": "JOIN_ROW",
	"PaymentIntent.tenantId,idempotencyKey": "NATURAL_KEY_KEPT",
	"PaymentIntent.provider,providerPaymentId": "SECRET_OR_GENERATED",
};

const MODEL_BLOCK = /^model (?<name>\w+) \{(?<body>[\s\S]*?)^\}/gmu;
const SOFT_DELETE_FIELD = /^\s*isDeleted\s+Boolean/mu;
const FIELD_UNIQUE = /^(?<field>\w+)\s+\S+.*\s@unique\b/u;
const COMPOUND_UNIQUE = /^@@unique\(\[(?<columns>[^\]]*)\]/u;

/** Every plain (non-partial) unique on a soft-deletable model in `schema`, as `Model.key`. */
export function fullUniquesOnSoftDeletableModels(schema: string): string[] {
	return [...schema.matchAll(MODEL_BLOCK)].flatMap((model: RegExpExecArray): string[] => {
		const name = model.groups?.name ?? "";
		const body = model.groups?.body ?? "";
		if (!SOFT_DELETE_FIELD.test(body)) {
			return [];
		}
		return body.split("\n").flatMap((raw: string): string[] => {
			const line = raw.trim();
			if (line.startsWith("//")) {
				return [];
			}
			const field = FIELD_UNIQUE.exec(line)?.groups?.field;
			if (field !== undefined) {
				return [`${name}.${field}`];
			}
			const columns = COMPOUND_UNIQUE.exec(line)?.groups?.columns;
			return columns === undefined || line.includes("where:") ? [] : [`${name}.${columns.replaceAll(" ", "")}`];
		});
	});
}
