import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import type {
	AdminCreateMerchantInviteInput,
	AdminKybUpdateInput,
	AdminMerchantDetailResponse,
	AdminMerchantListQuery,
	AdminRejectRewardInput,
	MerchantOrgResponse,
	PaginatedServiceResult,
	RewardResponse,
} from "@workspace/shared";
import { EmailPreview, EmailRenderContextSchema, EpochMsSchema } from "@workspace/shared";

import { parsePrismaInputJson } from "../../../common/utils/prisma-json";
import { TypedConfigService } from "../../../config/typed-config.service";
import { paginateCursorListResult } from "../../../platform/persistence/cursor-list";
import { LogService } from "../../logs/logs.service";
import { EmailSenderService } from "../../notifications/email/email-sender.service";
import { EMAIL_TEMPLATE_REGISTRY, buildEmailPreviewFromTemplate } from "../../notifications/email/email-template.registry";
import { MerchantInviteEmailTemplate } from "../../notifications/email/templates/merchant-invite-email.template";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import { OrganizationProvisioningService } from "../../organization/services/organization-provisioning.service";
import { RewardRepository } from "../repositories/reward.repository";
import { mapOrganizationToAdminDetailResponse, mapOrganizationToAdminResponse, mapRewardToResponse } from "../utils/reward-mapper.util";
import { MerchantKybDocumentService } from "./merchant-kyb-document.service";
import { MerchantRewardService } from "./merchant-reward.service";
import { RewardNotificationService } from "./reward-notification.service";

const INVITE_TTL_DAYS = 7;
const INVITE_PREVIEW_TOKEN = "preview-invite-token";

@Injectable()
export class RewardsAdminService {
	public constructor(
		private readonly organizationRepository: OrganizationRepository,
		private readonly organizationProvisioning: OrganizationProvisioningService,
		private readonly kybDocumentService: MerchantKybDocumentService,
		private readonly rewardRepository: RewardRepository,
		private readonly merchantRewardService: MerchantRewardService,
		private readonly notificationService: RewardNotificationService,
		private readonly emailSender: EmailSenderService,
		private readonly config: TypedConfigService,
		private readonly logService: LogService,
	) {}

	public async createMerchantInvite(adminUserId: string, input: AdminCreateMerchantInviteInput): Promise<{ inviteId: string; inviteToken: string; expiresAt: number }> {
		const provisioned = await this.organizationProvisioning.provisionFromRewardHubAdminInvite(adminUserId, input);

		const inviteUrl = this.buildMerchantInviteUrl(provisioned.inviteToken);
		const sendResult = await this.emailSender.send(
			new MerchantInviteEmailTemplate({
				to: input.email,
				businessName: input.businessName,
				cityLabel: this.formatPilotCityLabel(input.city),
				inviteUrl,
				expiresInDays: INVITE_TTL_DAYS,
			}),
		);

		if (!sendResult.ok) {
			this.logService.warn("Merchant invite email failed", {
				context: "RewardsAdminService",
				metadata: {
					inviteId: provisioned.inviteId,
					email: input.email,
					reason: sendResult.reason,
					...(sendResult.detail !== undefined ? { detail: sendResult.detail } : {}),
				},
			});
		}

		if (process.env.NODE_ENV !== "production") {
			// eslint-disable-next-line no-console -- dev visibility when EMAIL_MODE=log-only
			console.info(`[merchant-invite] email=${input.email} url=${inviteUrl}`);
		}

		return {
			inviteId: provisioned.inviteId,
			inviteToken: provisioned.inviteToken,
			expiresAt: EpochMsSchema.parse(provisioned.expiresAt),
		};
	}

	public previewMerchantInviteEmail(input: AdminCreateMerchantInviteInput): EmailPreview {
		const entry = EMAIL_TEMPLATE_REGISTRY["merchant-invite"];
		const inviteUrl = this.buildMerchantInviteUrl(INVITE_PREVIEW_TOKEN);
		const template = new MerchantInviteEmailTemplate({
			to: input.email,
			businessName: input.businessName,
			cityLabel: this.formatPilotCityLabel(input.city),
			inviteUrl,
			expiresInDays: INVITE_TTL_DAYS,
		});
		const context = EmailRenderContextSchema.parse({
			appName: this.config.appName,
			appUrl: this.config.appUrl,
			supportEmail: this.config.emailFromAddress,
		});
		return buildEmailPreviewFromTemplate(entry, template, context, input.email);
	}

	public async getMerchantDetail(organizationId: string): Promise<AdminMerchantDetailResponse> {
		const org = await this.organizationRepository.findForAdminDetail(organizationId);

		if (org === null) {
			throw new NotFoundException({ message: "Merchant not found", error: "MERCHANT_NOT_FOUND" });
		}

		const documents = await this.kybDocumentService.mapDocumentRecordsFromOrg(organizationId);
		return mapOrganizationToAdminDetailResponse(org, documents);
	}

	public async listMerchants(query: AdminMerchantListQuery): Promise<PaginatedServiceResult<MerchantOrgResponse>> {
		const result = await this.organizationRepository.listForAdmin(query);

		const items = result.items.map((row) => {
			const base = mapOrganizationToAdminResponse({ ...row, merchantProfile: row.merchantProfile });
			return { ...base, ownerUserId: row.memberships[0]?.userId ?? null };
		});

		return paginateCursorListResult({ ...result, items }, query);
	}

	public async listPendingRewards(): Promise<RewardResponse[]> {
		const rows = await this.rewardRepository.listPendingReview();
		return rows.map((row) => mapRewardToResponse(row, row.organization));
	}

	public async approveReward(adminUserId: string, rewardId: string): Promise<RewardResponse> {
		const reward = await this.findPendingConsumerReward(rewardId);
		const now = Date.now();

		await this.rewardRepository.approveInTransaction(reward.id, reward.referrerRewardId, adminUserId, now);

		const ownerUserIds = await this.organizationRepository.listOwnerUserIds(reward.organizationId);

		for (const ownerUserId of ownerUserIds) {
			await this.notificationService.notify(ownerUserId, "reward_approved", "Reward approved", `"${reward.title}" is now live in the marketplace.`, { rewardId: reward.id });
		}

		const refreshed = await this.rewardRepository.findUniqueOrThrowWithOrganization(reward.id);
		return mapRewardToResponse(refreshed, refreshed.organization);
	}

	public async rejectReward(adminUserId: string, rewardId: string, input: AdminRejectRewardInput): Promise<RewardResponse> {
		const reward = await this.findPendingConsumerReward(rewardId);
		const now = Date.now();

		await this.rewardRepository.rejectInTransaction(reward.id, reward.referrerRewardId, adminUserId, input.reason ?? null, now);

		const ownerUserIds = await this.organizationRepository.listOwnerUserIds(reward.organizationId);

		for (const ownerUserId of ownerUserIds) {
			await this.notificationService.notify(ownerUserId, "reward_rejected", "Reward needs changes", input.reason ?? "Your reward was returned to draft for edits.", {
				rewardId: reward.id,
			});
		}

		const refreshed = await this.rewardRepository.findUniqueOrThrowWithOrganization(reward.id);
		return mapRewardToResponse(refreshed, refreshed.organization);
	}

	public async updateMerchantKyb(organizationId: string, input: AdminKybUpdateInput): Promise<void> {
		const org = await this.organizationRepository.findById(organizationId);

		if (org === null) {
			throw new NotFoundException({ message: "Merchant not found", error: "MERCHANT_NOT_FOUND" });
		}

		await this.organizationRepository.updateMerchantProfileKyb(organizationId, {
			kybStatus: input.kybStatus,
			...(input.kybFields !== undefined ? { kybFields: parsePrismaInputJson(input.kybFields) } : {}),
		});
	}

	public async runScheduledJobs(): Promise<{ autoPublished: number; expiredClaims: number; expiredReferrerClaims: number }> {
		const autoPublished = await this.merchantRewardService.autoPublishPendingRewards();
		const expiredClaims = await this.merchantRewardService.expirePendingClaims();
		const expiredReferrerClaims = await this.merchantRewardService.expireReferrerClaims();
		return { autoPublished, expiredClaims, expiredReferrerClaims };
	}

	private buildMerchantInviteUrl(token: string): string {
		const base = this.config.merchantAppUrl.replace(/\/+$/, "");
		const params = new URLSearchParams({ token });
		return `${base}/onboarding?${params.toString()}`;
	}

	private formatPilotCityLabel(city: string): string {
		return city.replaceAll("_", " ");
	}

	private async findPendingConsumerReward(rewardId: string): Promise<{
		id: string;
		title: string;
		organizationId: string;
		referrerRewardId: string | null;
	}> {
		const reward = await this.rewardRepository.findPendingReviewById(rewardId);

		if (reward === null) {
			throw new NotFoundException({ message: "Reward not found", error: "REWARD_NOT_FOUND" });
		}

		if (reward.status !== "PENDING_REVIEW") {
			throw new BadRequestException({ message: "Reward is not pending review", error: "REWARD_NOT_PENDING" });
		}

		return reward;
	}
}
