import type { Prisma } from "@prisma/client";
import {
	APP_LINKS,
	EmailRenderContextSchema,
	PILOT_CITY_LABELS,
	type AdminMerchantInvitePreviewQuery,
	type EmailPreview,
	type EmailSendResult,
	type MembershipRole,
	TENANT_ROLE_TEMPLATE_NAMES,
} from "@workspace/shared";

import type { TypedConfigService } from "../../../../config/typed-config.service";
import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import type { LogService } from "../../../../platform/infrastructure/logging/logs.service";
import {
	buildEmailPreviewFromTemplate,
	EMAIL_TEMPLATE_REGISTRY,
	MerchantInviteEmailTemplate,
	TeamMemberInviteEmailTemplate,
	type NotificationsTransactionalPortsFactory,
	type EmailRequestTransactionalPort,
} from "../../../notifications/public-api";
import type { MerchantInviteEmail, MerchantInviteEmailPreviewPort, TenantEmailPort, TeamInviteEmail } from "../../application/ports/tenant-emails.port";
import { ONBOARDING_INVITE_TTL_DAYS } from "../../domain/policies/invitation-validity.policy";

const ROLE_LABELS: Readonly<Record<MembershipRole, string>> = TENANT_ROLE_TEMPLATE_NAMES;

/** Placeholder token in the admin's preview link (the real token only ever goes out in the sent email). */
const INVITE_PREVIEW_TOKEN = "preview-invite-token";
const LOG_CONTEXT = "TenantEmails";

/** `<merchant app>/<path>?token=…` without a doubled slash. */
function merchantLink(config: TypedConfigService, path: string, token: string): string {
	const base = config.clientApps.merchantUrl.replace(/\/+$/, "");
	return `${base}${path}?${new URLSearchParams({ token }).toString()}`;
}

/** Invite emails requested in the unit of work's transaction (ADR 060). */
export class TransactionTenantEmails implements TenantEmailPort {
	private readonly requests: EmailRequestTransactionalPort;

	public constructor(
		db: Prisma.TransactionClient,
		events: TransactionalEventCollector,
		notifications: NotificationsTransactionalPortsFactory,
		private readonly config: TypedConfigService,
		private readonly logs: LogService,
	) {
		this.requests = notifications.create(db, events).emailRequests;
	}

	public async sendTeamInvite(email: TeamInviteEmail): Promise<void> {
		const result = await this.requests.request(
			new TeamMemberInviteEmailTemplate({
				to: email.to,
				tenantName: email.tenantName,
				roleLabel: ROLE_LABELS[email.role],
				locationSummary: email.locationSummary,
				inviteUrl: merchantLink(this.config, APP_LINKS.merchant.teamInvite, email.rawToken),
				expiresInDays: email.expiresInDays,
			}),
		);
		this.warnIfRefused("Team member invite email failed", email.invitationId, result);
	}

	public async sendMerchantInvite(email: MerchantInviteEmail): Promise<void> {
		const result = await this.requests.request(
			new MerchantInviteEmailTemplate({
				to: email.to,
				businessName: email.businessName,
				cityLabel: PILOT_CITY_LABELS[email.city],
				inviteUrl: merchantLink(this.config, APP_LINKS.merchant.onboarding, email.rawToken),
				expiresInDays: email.expiresInDays,
			}),
		);
		this.warnIfRefused("Merchant invite email failed", email.invitationId, result);
	}

	/** The token never appears in the log line. */
	private warnIfRefused(message: string, inviteId: string, result: EmailSendResult): void {
		if (result.ok) {
			return;
		}
		this.logs.warn(message, {
			context: LOG_CONTEXT,
			metadata: { inviteId, reason: result.reason, ...(result.detail === undefined ? {} : { detail: result.detail }) },
		});
	}
}

/** Renders the merchant invite email for a live preview; the template's sample stands in for a missing business name and the recipient. */
export class MerchantInviteEmailPreviewAdapter implements MerchantInviteEmailPreviewPort {
	public constructor(private readonly config: TypedConfigService) {}

	public previewMerchantInvite(query: AdminMerchantInvitePreviewQuery): EmailPreview {
		const sample = MerchantInviteEmailTemplate.sampleProps;
		const template = new MerchantInviteEmailTemplate({
			to: sample.to,
			businessName: query.businessName ?? sample.businessName,
			cityLabel: PILOT_CITY_LABELS[query.city],
			inviteUrl: merchantLink(this.config, APP_LINKS.merchant.onboarding, INVITE_PREVIEW_TOKEN),
			expiresInDays: ONBOARDING_INVITE_TTL_DAYS,
		});
		const context = EmailRenderContextSchema.parse({
			appName: this.config.runtime.appName,
			appUrl: this.config.clientApps.webUrl,
			supportEmail: this.config.email.fromAddress,
		});
		return buildEmailPreviewFromTemplate(EMAIL_TEMPLATE_REGISTRY["merchant-invite"], template, context, sample.to);
	}
}
