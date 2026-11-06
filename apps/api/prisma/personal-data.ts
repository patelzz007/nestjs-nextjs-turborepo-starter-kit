// ============================================
// prisma/personal-data.ts — what account erasure does to every table that refers to a person (ADR 077)
// ============================================
// Each table holding a person's id or a copy of their personal values (email, name, phone, IP, user agent)
// is in exactly one class. The unit spec (prisma/__tests__/personal-data.spec.ts) fails on a table that
// refers to a person and isn't listed, and on a stale entry, so erasure can never silently miss a table.

/** What erasure does to a table's rows about the person. */
export type PersonalDataClass =
	/** The person's own data with no value to anyone else: removed (or, for live sessions and grants, ended). */
	| "ERASE"
	/** Kept for someone else's records (a merchant's sales, a team's history); the person is the "Deleted user" tombstone, copied values cleared. */
	| "ANONYMISE"
	/** A security or legal record kept for the retention (ADR 078): who and what stay as ids, copied personal values are masked. */
	| "KEEP_MASKED"
	/** The merchant's own record, which the merchant must keep (ADR 077, Q12): not erased by the platform. */
	| "MERCHANT_RECORD"
	/** The account row itself, kept as the tombstone every id above still points at. */
	| "TOMBSTONE";

/** One table's decision: its class, and why. */
export interface PersonalDataDecision {
	readonly class: PersonalDataClass;
	readonly reason: string;
}

const SESSION = "A sign-in artefact of the person's own account";
const OWN_SETTING = "The person's own setting, of no use once the account is gone";
const SECURITY_RECORD = "Security record kept for the ten-year retention; ip and user agent masked";
const AUDIT_TRAIL = "Audit trail kept for the ten-year retention (ADR 078); copied personal values masked";
const OTHERS_RECORD = "Someone else's record that names the person: kept, pointing at the tombstone";
const STAFF_ACTION = "Records which staff member did something; kept, pointing at the tombstone";

export const PERSONAL_DATA_CLASSES: Readonly<Record<string, PersonalDataDecision>> = {
	AccountErasure: { class: "KEEP_MASKED", reason: "The evidence that the erasure was asked for (by whom, why) and carried out" },
	User: { class: "TOMBSTONE", reason: "Kept so every id still resolves; email, name, phone and password replaced, erasedAt set" },
	// ── Identity ─────────────────────────────────────────────────────────────
	PasswordResetToken: { class: "ERASE", reason: SESSION },
	PasswordHistory: { class: "ERASE", reason: SESSION },
	BackupCode: { class: "ERASE", reason: SESSION },
	TwoFactorPendingSetup: { class: "ERASE", reason: SESSION },
	TwoFactorLoginChallenge: { class: "ERASE", reason: SESSION },
	WebAuthnCredential: { class: "ERASE", reason: "The person's passkeys: public keys of credentials only they hold" },
	WebAuthnChallenge: { class: "ERASE", reason: SESSION },
	RefreshToken: { class: "ERASE", reason: "Every session ended; device names, IPs and places cleared" },
	UserAvatar: { class: "ERASE", reason: "The person's own photo" },
	UserPreference: { class: "ERASE", reason: OWN_SETTING },
	MfaRecoveryRequest: { class: "KEEP_MASKED", reason: `${SECURITY_RECORD}. An open request blocks erasure` },
	MfaRecoveryAuditLog: { class: "KEEP_MASKED", reason: SECURITY_RECORD },
	ImpersonationAuditLog: { class: "KEEP_MASKED", reason: SECURITY_RECORD },
	ImpersonationSession: { class: "KEEP_MASKED", reason: SECURITY_RECORD },
	GithubAccountLink: { class: "ERASE", reason: "The person's linked GitHub account and its encrypted token" },
	// ── Authorization ────────────────────────────────────────────────────────
	UserRole: { class: "ERASE", reason: "Platform roles of an account that no longer exists" },
	UserPermission: { class: "ERASE", reason: "Grants of an account that no longer exists" },
	PermissionAuditLog: { class: "KEEP_MASKED", reason: AUDIT_TRAIL },
	AuthorizationAudit: { class: "KEEP_MASKED", reason: AUDIT_TRAIL },
	SupportAccessGrant: { class: "KEEP_MASKED", reason: SECURITY_RECORD },
	// ── Tenancy ──────────────────────────────────────────────────────────────
	Location: { class: "ANONYMISE", reason: STAFF_ACTION },
	Membership: { class: "ERASE", reason: "Every membership ended and its display name cleared. Owning a tenant blocks erasure" },
	TenantInvitation: { class: "ERASE", reason: "Invitations accepted by or open to the person" },
	TenantAccessRequest: { class: "ERASE", reason: "The person's own requests to join a tenant" },
	TenantSuspensionAppeal: { class: "ANONYMISE", reason: STAFF_ACTION },
	TenantCustomerBan: { class: "MERCHANT_RECORD", reason: "A merchant's safety decision about a customer (ADR 077)" },
	TenantLifecycleEvent: { class: "KEEP_MASKED", reason: AUDIT_TRAIL },
	TenantAuditLog: { class: "KEEP_MASKED", reason: AUDIT_TRAIL },
	TenantCustomer: { class: "ANONYMISE", reason: "The store's record of the customer, kept so its visit counts stay true (Q11)" },
	TenantApiKey: { class: "ANONYMISE", reason: STAFF_ACTION },
	WebhookEndpoint: { class: "ANONYMISE", reason: STAFF_ACTION },
	TenantTerminal: { class: "ANONYMISE", reason: STAFF_ACTION },
	TenantRateLimitOverride: { class: "ANONYMISE", reason: STAFF_ACTION },
	// ── Files ────────────────────────────────────────────────────────────────
	StoredFile: { class: "ANONYMISE", reason: "Files uploaded for a tenant or reward stay; the person's avatar goes with UserAvatar" },
	// ── Rewards, claims, referrals ───────────────────────────────────────────
	Reward: { class: "ANONYMISE", reason: STAFF_ACTION },
	RewardAudienceMember: { class: "ERASE", reason: "Targets the person for an offer; nobody can claim for a deleted account" },
	RewardLegalAcceptance: { class: "KEEP_MASKED", reason: "Proof that terms were accepted, kept for the retention" },
	RewardAuditLog: { class: "KEEP_MASKED", reason: AUDIT_TRAIL },
	RewardClaim: { class: "ANONYMISE", reason: OTHERS_RECORD },
	RewardClaimHold: { class: "ANONYMISE", reason: OTHERS_RECORD },
	RewardOtpChallenge: { class: "ERASE", reason: "A one-time code sent to the person's phone" },
	RewardNotification: { class: "ERASE", reason: OWN_SETTING },
	RewardReferral: { class: "ANONYMISE", reason: `${OTHERS_RECORD}; the referee's IP cleared` },
	RewardRedemption: { class: "MERCHANT_RECORD", reason: "Part of the merchant's sale record (Income Tax Act 1967 s.82)" },
	RewardSale: { class: "MERCHANT_RECORD", reason: "The merchant's sale record (Income Tax Act 1967 s.82)" },
	SignupReferralCode: { class: "ERASE", reason: "The person's own invite code" },
	SignupReferral: { class: "ANONYMISE", reason: OTHERS_RECORD },
	GithubWebhookSubscription: { class: "ANONYMISE", reason: STAFF_ACTION },
	// ── Kanban ───────────────────────────────────────────────────────────────
	KanbanTask: { class: "ANONYMISE", reason: "The team's work item; its owner becomes the tombstone" },
	KanbanTaskComment: { class: "ANONYMISE", reason: "The team's discussion; its author becomes the tombstone" },
	KanbanChecklistItem: { class: "ANONYMISE", reason: OTHERS_RECORD },
	KanbanTaskWatcher: { class: "ERASE", reason: "The person following a task" },
	KanbanTaskActivity: { class: "KEEP_MASKED", reason: AUDIT_TRAIL },
	// ── Notifications ────────────────────────────────────────────────────────
	EmailLog: { class: "KEEP_MASKED", reason: "The record of what was sent; the recipient address masked" },
	Notification: { class: "KEEP_MASKED", reason: "The record of what was sent; the recipient key masked" },
	NotificationDelivery: { class: "KEEP_MASKED", reason: "The record of each delivery attempt" },
	InAppNotification: { class: "ERASE", reason: "The person's own inbox" },
	NotificationPreference: { class: "ERASE", reason: OWN_SETTING },
	NotificationSchedule: { class: "ERASE", reason: OWN_SETTING },
	MarketingConsent: { class: "KEEP_MASKED", reason: "Proof of consent and withdrawal (ADR 070), kept; ip and user agent masked" },
	PushDevice: { class: "ERASE", reason: "Phones registered for push, revoked" },
	Broadcast: { class: "ANONYMISE", reason: STAFF_ACTION },
	BroadcastReport: { class: "ANONYMISE", reason: OTHERS_RECORD },
	// ── Audit and operations ─────────────────────────────────────────────────
	AuditLog: { class: "KEEP_MASKED", reason: `${AUDIT_TRAIL}: ip, user agent, browser, OS and personal values in bodies` },
	DataChangeLog: { class: "KEEP_MASKED", reason: `${AUDIT_TRAIL}: personal values inside the before / after snapshots` },
	AuditLegalHold: { class: "ANONYMISE", reason: STAFF_ACTION },
	LoadTestRun: { class: "ANONYMISE", reason: STAFF_ACTION },
	OpsBackup: { class: "ANONYMISE", reason: STAFF_ACTION },
	StatusIncident: { class: "ANONYMISE", reason: STAFF_ACTION },
	SavedListView: { class: "ERASE", reason: OWN_SETTING },
	StatusIncidentUpdate: { class: "ANONYMISE", reason: STAFF_ACTION },
	// ── Payments ─────────────────────────────────────────────────────────────
	PaymentIntent: { class: "MERCHANT_RECORD", reason: "The merchant's payment record, payer details kept ten years (Q12)" },
};

const MODEL_BLOCK = /^model (?<name>\w+) \{(?<body>[\s\S]*?)^\}/gmu;
/** A relation to the account, a person-id column, or a copied personal value. */
const PERSON_FIELD = /^\s+(?<field>\w+)\s+(?<type>\w+)/u;
const PERSON_ID_COLUMN = /^(?:userId|ownerId|\w+UserId|\w+ById)$/u;
const COPIED_PERSONAL_COLUMN = /^(?:email|phone|fullName|ipAddress|lastIpAddress|ip|refereeIp|userAgent|payerName|payerEmail|recipientKey|to)$/u;

/** Every model in `schema` that refers to a person (by relation, id column or copied value), sorted. */
export function modelsReferringToAPerson(schema: string): string[] {
	return [...schema.matchAll(MODEL_BLOCK)]
		.filter((model: RegExpExecArray): boolean =>
			(model.groups?.body ?? "").split("\n").some((raw: string): boolean => {
				if (raw.trim().startsWith("/")) {
					return false;
				}
				const match = PERSON_FIELD.exec(raw)?.groups;
				const field = match?.field ?? "";
				return match?.type === "User" || PERSON_ID_COLUMN.test(field) || COPIED_PERSONAL_COLUMN.test(field);
			}),
		)
		.map((model: RegExpExecArray): string => model.groups?.name ?? "")
		.sort();
}
