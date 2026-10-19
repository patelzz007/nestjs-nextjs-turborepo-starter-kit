import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { bindFileReferenceGuard, FileCategoryAccessRegistry, FileReferenceGuardRegistry } from "../../../files/public-api";
import { ORGANIZATION_FILE_ACCESS, type OrganizationFileAccessPort } from "../../../organizations/public-api";
import { REWARD_IMAGE_CAPABILITIES } from "../../application/services/reward-image-file-capabilities";
import { RewardImageInUseGuard } from "../../application/services/reward-image-in-use.guard";
import { RewardImageFileScopeFactory } from "./prisma-reward-image-files";

/**
 * Rewards owns REWARD_IMAGE: an organization file decided on the caller's
 * current membership (organizations' check), and never deletable while a live
 * reward shows it.
 */
@Injectable()
export class RewardsFileRegistrations implements OnModuleInit {
	public constructor(
		private readonly access: FileCategoryAccessRegistry,
		@Inject(FileReferenceGuardRegistry) private readonly guards: FileReferenceGuardRegistry<Prisma.TransactionClient>,
		@Inject(ORGANIZATION_FILE_ACCESS) private readonly organizationFiles: OrganizationFileAccessPort,
	) {}

	public onModuleInit(): void {
		this.access.register(this.organizationFiles.ruleFor(["REWARD_IMAGE"], REWARD_IMAGE_CAPABILITIES));
		this.guards.register(bindFileReferenceGuard(new RewardImageInUseGuard(), new RewardImageFileScopeFactory()));
	}
}
