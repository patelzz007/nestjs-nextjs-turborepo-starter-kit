import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import type {
	AdminCreateMerchantInviteInput,
	AdminKybUpdateInput,
	AdminMerchantListQuery,
	AdminRejectRewardInput,
	MerchantOrgResponse,
	RewardResponse,
} from "@workspace/shared";
import { EmailPreview, EmailRenderContextSchema, EpochMsSchema } from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";
import { LogService } from "../../logs/logs.service";
import { EmailSenderService } from "../../notifications/email/email-sender.service";
import { EMAIL_TEMPLATE_REGISTRY, buildEmailPreviewFromTemplate } from "../../notifications/email/email-template.registry";
import { MerchantInviteEmailTemplate } from "../../notifications/email/templates/merchant-invite-email.template";
import { PrismaService } from "../../../prisma/prisma.service";
import { generateOpaqueToken, sha256Hex } from "../utils/reward-crypto.util";
import { mapMerchantOrgToResponse, mapRewardToResponse } from "../utils/reward-mapper.util";
import { MerchantRewardService } from "./merchant-reward.service";
import { RewardNotificationService } from "./reward-notification.service";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INVITE_TTL_DAYS = 7;
const INVITE_PREVIEW_TOKEN = "preview-invite-token";

@Injectable()
export class RewardsAdminService {
	public constructor(
		private readonly prisma: PrismaService,
		private readonly merchantRewardService: MerchantRewardService,
		private readonly notificationService: RewardNotificationService,
		private readonly emailSender: EmailSenderService,
		private readonly config: TypedConfigService,
		private readonly logService: LogService,
	) {}

	public async createMerchantInvite(adminUserId: string, input: AdminCreateMerchantInviteInput): Promise<{ inviteId: string; inviteToken: string; expiresAt: number }> {
		const token = generateOpaqueToken();
		const expiresAt = Date.now() + INVITE_TTL_MS;

		const invite = await this.prisma.merchantInvite.create({
			data: {
				email: input.email,
				tokenHash: sha256Hex(token),
				businessName: input.businessName,
				city: input.city,
				createdByAdminId: adminUserId,
				expiresAt,
			},
		});

		const inviteUrl = this.buildMerchantInviteUrl(token);
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
					inviteId: invite.id,
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
			inviteId: invite.id,
			inviteToken: token,
			expiresAt: EpochMsSchema.parse(Number(invite.expiresAt)),
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

	public async listMerchants(query: AdminMerchantListQuery): Promise<{
		readonly items: MerchantOrgResponse[];
		readonly total: number;
		readonly page: number;
		readonly limit: number;
		readonly totalPages: number;
		readonly hasNext: boolean;
		readonly hasPrevious: boolean;
	}> {
		const page = query.page;
		const limit = query.limit;
		const skip = (page - 1) * limit;

		const search = query.search?.trim();
		const where = {
			isDeleted: false,
			...(query.city !== undefined ? { city: query.city } : {}),
			...(query.kybStatus !== undefined ? { kybStatus: query.kybStatus } : {}),
			...(query.status !== undefined ? { status: query.status } : {}),
			...(search !== undefined && search.length > 0
				? {
						OR: [
							{ businessName: { contains: search, mode: "insensitive" as const } },
							{ legalName: { contains: search, mode: "insensitive" as const } },
							{ contactEmail: { contains: search, mode: "insensitive" as const } },
						],
					}
				: {}),
		};

		const [rows, total] = await Promise.all([
			this.prisma.merchantOrg.findMany({
				where,
				orderBy: { createdAt: "desc" },
				skip,
				take: limit,
				include: {
					members: {
						where: { role: "OWNER", isDeleted: false },
						select: { userId: true },
						take: 1,
					},
				},
			}),
			this.prisma.merchantOrg.count({ where }),
		]);

		const items = rows.map((row) => {
			const base = mapMerchantOrgToResponse(row);
			const ownerUserId = row.members[0]?.userId ?? null;
			return ownerUserId === null ? base : { ...base, ownerUserId };
		});
		const totalPages = limit === 0 ? 0 : Math.ceil(total / limit);

		return {
			items,
			total,
			page,
			limit,
			totalPages,
			hasNext: page < totalPages,
			hasPrevious: page > 1,
		};
	}

	public async listPendingRewards(): Promise<RewardResponse[]> {
		const rows = await this.prisma.reward.findMany({
			where: { status: "PENDING_REVIEW", isDeleted: false, rewardKind: "CONSUMER" },
			include: { merchantOrg: { select: { businessName: true } } },
			orderBy: { submittedForReviewAt: "asc" },
		});

		return rows.map((row) => mapRewardToResponse(row, row.merchantOrg));
	}

	public async approveReward(adminUserId: string, rewardId: string): Promise<RewardResponse> {
		const reward = await this.findPendingConsumerReward(rewardId);
		const now = Date.now();

		await this.prisma.$transaction(async (tx) => {
			await tx.reward.update({
				where: { id: reward.id },
				data: {
					status: "PUBLISHED",
					reviewedAt: now,
					reviewedByUserId: adminUserId,
					autoPublishAt: null,
					rejectionReason: null,
				},
			});

			if (reward.referrerRewardId !== null) {
				await tx.reward.update({
					where: { id: reward.referrerRewardId },
					data: {
						status: "PUBLISHED",
						reviewedAt: now,
						reviewedByUserId: adminUserId,
						autoPublishAt: null,
					},
				});
			}
		});

		const owners = await this.prisma.merchantMember.findMany({
			where: { merchantOrgId: reward.merchantOrgId, role: "OWNER", isDeleted: false },
		});

		for (const owner of owners) {
			await this.notificationService.notify(owner.userId, "reward_approved", "Reward approved", `"${reward.title}" is now live in the marketplace.`, { rewardId: reward.id });
		}

		const refreshed = await this.prisma.reward.findUniqueOrThrow({
			where: { id: reward.id },
			include: { merchantOrg: { select: { businessName: true } } },
		});

		return mapRewardToResponse(refreshed, refreshed.merchantOrg);
	}

	public async rejectReward(adminUserId: string, rewardId: string, input: AdminRejectRewardInput): Promise<RewardResponse> {
		const reward = await this.findPendingConsumerReward(rewardId);
		const now = Date.now();

		await this.prisma.$transaction(async (tx) => {
			await tx.reward.update({
				where: { id: reward.id },
				data: {
					status: "DRAFT",
					reviewedAt: now,
					reviewedByUserId: adminUserId,
					autoPublishAt: null,
					rejectionReason: input.reason ?? null,
					submittedForReviewAt: null,
				},
			});

			if (reward.referrerRewardId !== null) {
				await tx.reward.update({
					where: { id: reward.referrerRewardId },
					data: {
						status: "DRAFT",
						reviewedAt: now,
						reviewedByUserId: adminUserId,
						autoPublishAt: null,
						submittedForReviewAt: null,
					},
				});
			}
		});

		const owners = await this.prisma.merchantMember.findMany({
			where: { merchantOrgId: reward.merchantOrgId, role: "OWNER", isDeleted: false },
		});

		for (const owner of owners) {
			await this.notificationService.notify(owner.userId, "reward_rejected", "Reward needs changes", input.reason ?? "Your reward was returned to draft for edits.", {
				rewardId: reward.id,
			});
		}

		const refreshed = await this.prisma.reward.findUniqueOrThrow({
			where: { id: reward.id },
			include: { merchantOrg: { select: { businessName: true } } },
		});

		return mapRewardToResponse(refreshed, refreshed.merchantOrg);
	}

	public async updateMerchantKyb(merchantOrgId: string, input: AdminKybUpdateInput): Promise<void> {
		const org = await this.prisma.merchantOrg.findFirst({
			where: { id: merchantOrgId, isDeleted: false },
		});

		if (org === null) {
			throw new NotFoundException({ message: "Merchant not found", error: "MERCHANT_NOT_FOUND" });
		}

		await this.prisma.merchantOrg.update({
			where: { id: merchantOrgId },
			data: {
				kybStatus: input.kybStatus,
				...(input.kybFields !== undefined ? { kybFields: input.kybFields } : {}),
			},
		});
	}

	public async runScheduledJobs(): Promise<{ autoPublished: number; expiredClaims: number }> {
		const autoPublished = await this.merchantRewardService.autoPublishPendingRewards();
		const expiredClaims = await this.merchantRewardService.expirePendingClaims();
		return { autoPublished, expiredClaims };
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
		merchantOrgId: string;
		referrerRewardId: string | null;
	}> {
		const reward = await this.prisma.reward.findFirst({
			where: { id: rewardId, isDeleted: false, rewardKind: "CONSUMER" },
			select: { id: true, title: true, merchantOrgId: true, referrerRewardId: true, status: true },
		});

		if (reward === null) {
			throw new NotFoundException({ message: "Reward not found", error: "REWARD_NOT_FOUND" });
		}

		if (reward.status !== "PENDING_REVIEW") {
			throw new BadRequestException({ message: "Reward is not pending review", error: "REWARD_NOT_PENDING" });
		}

		return reward;
	}
}
