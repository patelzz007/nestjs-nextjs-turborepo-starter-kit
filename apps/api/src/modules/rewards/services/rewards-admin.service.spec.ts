import { Test } from "@nestjs/testing";
import { LIST_SLOT_INDEX } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TypedConfigService } from "../../../config/typed-config.service";
import { createTestTypedConfig } from "../../../../test/support/test-api-env";
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

vi.mock("../../../prisma/prisma.service", () => ({ PrismaService: class {} }));

/** A recognisable stand-in for the random invite token the provisioning service mints. */
const INVITE_TOKEN = "f".repeat(64);
const INVITE_TTL_MS = 7 * 86_400_000;

/** The collaborators a test drives; every other dependency is an inert stub. */
interface ServiceDoubles {
	readonly provisioning?: Pick<OrganizationProvisioningService, "provisionFromRewardHubAdminInvite">;
	readonly emailSender?: Pick<EmailSenderService, "send">;
	readonly logService?: Pick<LogService, "warn" | "info">;
}

async function compileService(doubles: ServiceDoubles): Promise<RewardsAdminService> {
	const moduleRef = await Test.createTestingModule({
		providers: [
			RewardsAdminService,
			{ provide: OrganizationRepository, useValue: {} },
			{ provide: OrganizationLocationRepository, useValue: {} },
			{ provide: OrganizationProvisioningService, useValue: doubles.provisioning ?? {} },
			{ provide: MerchantKybDocumentService, useValue: {} },
			{ provide: RewardRepository, useValue: {} },
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
