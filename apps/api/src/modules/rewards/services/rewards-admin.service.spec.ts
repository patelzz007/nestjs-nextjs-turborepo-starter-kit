import { Readable } from "node:stream";

import { Test } from "@nestjs/testing";
import { EpochMsSchema, LIST_SLOT_INDEX } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TypedConfigService } from "../../../config/typed-config.service";
import { storedFile } from "../../../../test/support/file-lifecycle-fakes";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";
import { FileService } from "../../files/services/file.service";
import { LogService } from "../../logs/logs.service";
import { EmailSenderService } from "../../notifications/email/email-sender.service";
import { OrganizationLocationRepository } from "../../organization/repositories/organization-location.repository";
import { OrganizationRepository } from "../../organization/repositories/organization.repository";
import { OrganizationProvisioningService } from "../../organization/services/organization-provisioning.service";
import { RewardRepository } from "../repositories/reward.repository";
import { MerchantKybDocumentService } from "./merchant-kyb-document.service";
import { MerchantInviteEmailTemplate } from "../../notifications/email/templates/merchant-invite-email.template";
import { MerchantRewardService } from "./merchant-reward.service";
import { RewardNotificationService } from "./reward-notification.service";
import { RewardsAdminService } from "./rewards-admin.service";
import { PublicUrlResolver } from "../../../config/public-url.resolver";
import { createTestPublicUrls } from "../../../../test/support/public-urls";

vi.mock("../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

/** A recognisable stand-in for the random invite token the provisioning service mints. */
const INVITE_TOKEN = "f".repeat(64);
const INVITE_TTL_MS = 7 * 86_400_000;

/** The collaborators a test drives; every other dependency is an inert stub. */
interface ServiceDoubles {
	readonly provisioning?: Pick<OrganizationProvisioningService, "provisionFromRewardHubAdminInvite">;
	readonly emailSender?: Pick<EmailSenderService, "send">;
	readonly logService?: Pick<LogService, "warn" | "info">;
	readonly rewardRepository?: Partial<Pick<RewardRepository, "findRewardImageFile" | "findRewardImageFiles" | "findConsumerWithOrganization">>;
	readonly fileService?: Partial<Pick<FileService, "createDownloadUrl" | "createZipArchive">>;
}

async function compileService(doubles: ServiceDoubles): Promise<RewardsAdminService> {
	const moduleRef = await Test.createTestingModule({
		providers: [
			RewardsAdminService,
			{ provide: PublicUrlResolver, useValue: createTestPublicUrls() },
			{ provide: OrganizationRepository, useValue: {} },
			{ provide: OrganizationLocationRepository, useValue: {} },
			{ provide: OrganizationProvisioningService, useValue: doubles.provisioning ?? {} },
			{ provide: MerchantKybDocumentService, useValue: {} },
			{ provide: RewardRepository, useValue: doubles.rewardRepository ?? {} },
			{ provide: FileService, useValue: doubles.fileService ?? {} },
			{ provide: MerchantRewardService, useValue: {} },
			{ provide: RewardNotificationService, useValue: {} },
			{ provide: EmailSenderService, useValue: doubles.emailSender ?? {} },
			// Not production: the branch that used to print the invite URL to stdout.
			{ provide: TypedConfigService, useValue: createTestTypedConfig() },
			{ provide: LogService, useValue: doubles.logService ?? {} },
		],
	}).compile();
	return moduleRef.get(RewardsAdminService);
}

describe("RewardsAdminService.createMerchantInvite", () => {
	let service: RewardsAdminService;
	const provisioning = { provisionFromRewardHubAdminInvite: vi.fn<OrganizationProvisioningService["provisionFromRewardHubAdminInvite"]>() };
	const emailSender = { send: vi.fn<EmailSenderService["send"]>() };
	const logService = { warn: vi.fn<LogService["warn"]>(), info: vi.fn<LogService["info"]>() };

	beforeEach(async () => {
		vi.clearAllMocks();
		provisioning.provisionFromRewardHubAdminInvite.mockResolvedValue({
			organizationId: "0b6a3c55-2f1d-4e8a-a7b9-5c4d3e2f1a10",
			inviteId: "1c8d3b6f-7a2e-4d3f-8e4b-2a3f4e5d6c7b",
			inviteToken: INVITE_TOKEN,
			expiresAt: Date.now() + INVITE_TTL_MS,
		});
		service = await compileService({ provisioning, emailSender, logService });
	});

	const SEND_OUTCOMES: [label: string, result: Awaited<ReturnType<EmailSenderService["send"]>>][] = [
		["the email is sent", { ok: true, id: "noop", mode: "noop" }],
		["the email fails", { ok: false, reason: "api-error" }],
	];

	it.each(SEND_OUTCOMES)("never writes the invite token to stdout or the logs when %s", async (_label, result) => {
		const stdout = vi.spyOn(process.stdout, "write");
		emailSender.send.mockResolvedValue(result);

		await service.createMerchantInvite("2d9e4c7a-8b3f-4e5a-9f5c-3b4a5f6e7d8c", { email: "owner@example.com", businessName: "Kopi Co", city: "KUALA_LUMPUR" });

		expect(JSON.stringify(emailSender.send.mock.lastCall)).toContain(INVITE_TOKEN);
		expect(stdout.mock.calls.map((call) => String(call[LIST_SLOT_INDEX.first])).join("")).not.toContain(INVITE_TOKEN);
		expect(JSON.stringify([...logService.warn.mock.calls, ...logService.info.mock.calls])).not.toContain(INVITE_TOKEN);
		stdout.mockRestore();
	});
});

describe("RewardsAdminService.previewMerchantInviteEmail", () => {
	let service: RewardsAdminService;

	beforeEach(async () => {
		service = await compileService({});
	});

	it("renders the business name and pilot city the admin typed", () => {
		const preview = service.previewMerchantInviteEmail({ businessName: "Kopi Co", city: "MELAKA" });

		expect(preview.key).toBe("merchant-invite");
		expect(preview.html).toContain("Kopi Co");
		expect(preview.html).toContain("Melaka");
		expect(preview.previewText).toBe("Complete onboarding for Kopi Co in Melaka.");
	});

	it("stands in the template's sample business name until one is typed", () => {
		const preview = service.previewMerchantInviteEmail({ city: "KUALA_LUMPUR" });

		expect(preview.html).toContain(MerchantInviteEmailTemplate.sampleProps.businessName);
		expect(preview.previewText).toContain("Kuala Lumpur");
	});

	it("addresses the sample recipient, never a real one, and links a placeholder token, never a live invite", () => {
		const preview = service.previewMerchantInviteEmail({ businessName: "Kopi Co", city: "KUALA_LUMPUR" });

		expect(preview.to).toBe(MerchantInviteEmailTemplate.sampleProps.to);
		expect(preview.html).not.toContain(INVITE_TOKEN);
	});
});

describe("RewardsAdminService.getReward", () => {
	const REWARD_ID = "5b2c7e19-0d4a-4e8f-9a3b-6c1d2e3f4a5b";
	const rewardRepository = { findConsumerWithOrganization: vi.fn<RewardRepository["findConsumerWithOrganization"]>() };
	let service: RewardsAdminService;

	beforeEach(async () => {
		vi.clearAllMocks();
		service = await compileService({ rewardRepository });
	});

	it("is a 404 for a reward that does not exist (or was deleted)", async () => {
		rewardRepository.findConsumerWithOrganization.mockResolvedValue(null);

		await expect(service.getReward({ rewardId: REWARD_ID })).rejects.toMatchObject({ response: { error: "REWARD_NOT_FOUND" } });
		expect(rewardRepository.findConsumerWithOrganization).toHaveBeenCalledWith(REWARD_ID);
	});
});

describe("RewardsAdminService.getRewardImageDownload", () => {
	const REWARD_ID = "3e0f5d8b-9c4a-4f6b-8a6d-4c5b6a7f8e9d";
	const FILE_ID = "4f1a6e9c-ad5b-4a7c-9b7e-5d6c7b8a9f0e";
	const DOWNLOAD_TTL_MS = 300_000;
	const rewardRepository = { findRewardImageFile: vi.fn<RewardRepository["findRewardImageFile"]>() };
	const fileService = { createDownloadUrl: vi.fn<FileService["createDownloadUrl"]>() };
	let service: RewardsAdminService;

	beforeEach(async () => {
		vi.clearAllMocks();
		service = await compileService({ rewardRepository, fileService });
	});

	it("downloads the original upload as an attachment named after it", async () => {
		const file = storedFile({ id: FILE_ID, originalName: "teh-tarik.webp", category: "REWARD_IMAGE" });
		const expiresAt = EpochMsSchema.parse(Date.now() + DOWNLOAD_TTL_MS);
		rewardRepository.findRewardImageFile.mockResolvedValue(file);
		fileService.createDownloadUrl.mockResolvedValue({ fileId: FILE_ID, status: "READY", downloadUrl: "https://files.example.com/signed", expiresAt });

		await expect(service.getRewardImageDownload({ rewardId: REWARD_ID, fileId: FILE_ID })).resolves.toEqual({
			fileId: FILE_ID,
			fileName: "teh-tarik.webp",
			downloadUrl: "https://files.example.com/signed",
			expiresAt,
		});
		expect(rewardRepository.findRewardImageFile).toHaveBeenCalledWith(REWARD_ID, FILE_ID);
		expect(fileService.createDownloadUrl).toHaveBeenCalledWith(file, "attachment");
	});

	it("is a 404 for a file that is not one of the reward's live images", async () => {
		rewardRepository.findRewardImageFile.mockResolvedValue(null);

		await expect(service.getRewardImageDownload({ rewardId: REWARD_ID, fileId: FILE_ID })).rejects.toMatchObject({
			response: { error: "REWARD_IMAGE_NOT_FOUND" },
		});
		expect(fileService.createDownloadUrl).not.toHaveBeenCalled();
	});

	it("is a 404 when storage has no URL for the file", async () => {
		rewardRepository.findRewardImageFile.mockResolvedValue(storedFile({ id: FILE_ID, category: "REWARD_IMAGE" }));
		fileService.createDownloadUrl.mockResolvedValue({ fileId: FILE_ID, status: "PROCESSING", downloadUrl: null, expiresAt: null });

		await expect(service.getRewardImageDownload({ rewardId: REWARD_ID, fileId: FILE_ID })).rejects.toMatchObject({
			response: { error: "REWARD_IMAGE_NOT_FOUND" },
		});
	});
});

describe("RewardsAdminService.getRewardImagesArchive", () => {
	const REWARD_ID = "3e0f5d8b-9c4a-4f6b-8a6d-4c5b6a7f8e9d";
	const rewardRepository = { findRewardImageFiles: vi.fn<RewardRepository["findRewardImageFiles"]>() };
	const fileService = { createZipArchive: vi.fn<FileService["createZipArchive"]>() };
	let service: RewardsAdminService;

	beforeEach(async () => {
		vi.clearAllMocks();
		service = await compileService({ rewardRepository, fileService });
	});

	it("archives the reward's images in display order, named after the reward", async () => {
		const files = [storedFile({ category: "REWARD_IMAGE" }), storedFile({ category: "REWARD_IMAGE" })];
		const body = Readable.from([Buffer.from("PK")]);
		rewardRepository.findRewardImageFiles.mockResolvedValue({ title: "20% off weekend brunch", files });
		fileService.createZipArchive.mockReturnValue(body);

		await expect(service.getRewardImagesArchive({ rewardId: REWARD_ID })).resolves.toEqual({
			fileName: "20-off-weekend-brunch-photos.zip",
			contentType: "application/zip",
			body,
		});
		expect(rewardRepository.findRewardImageFiles).toHaveBeenCalledWith(REWARD_ID);
		expect(fileService.createZipArchive).toHaveBeenCalledWith(files);
	});

	it("names the archive generically when the title has no file-name-safe character", async () => {
		rewardRepository.findRewardImageFiles.mockResolvedValue({ title: "咖啡", files: [storedFile({ category: "REWARD_IMAGE" })] });
		fileService.createZipArchive.mockReturnValue(Readable.from([]));

		await expect(service.getRewardImagesArchive({ rewardId: REWARD_ID })).resolves.toMatchObject({ fileName: "reward-photos.zip" });
	});

	it.each([
		["does not exist", null],
		["has no image", { title: "Free teh tarik", files: [] }],
	])("is a 404 before any byte is sent when the reward %s", async (_case, found) => {
		rewardRepository.findRewardImageFiles.mockResolvedValue(found);

		await expect(service.getRewardImagesArchive({ rewardId: REWARD_ID })).rejects.toMatchObject({ response: { error: "REWARD_IMAGE_NOT_FOUND" } });
		expect(fileService.createZipArchive).not.toHaveBeenCalled();
	});
});
