import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { MERCHANT_CAPABILITY } from "@workspace/shared";

import { AUTHORIZATION_KERNEL, type AuthorizationKernelPort } from "../../../authorization/public-api";
import { bindFileReferenceGuard, FileCategoryAccessRegistry, FileReferenceGuardRegistry } from "../../../files/public-api";
import { TENANT_FILE_ACCESS, type TenantFileAccessPort } from "../../../tenancy/public-api";
import { BroadcastImageInUseGuard } from "../../application/services/broadcast-image-in-use.guard";
import { PlatformBroadcastImageFileAccessRule } from "../../application/services/platform-broadcast-image-file-access.rule";
import { BroadcastImageUseScopeFactory } from "./prisma-broadcast-image-uses";

/**
 * Notifications owns the broadcast pictures (enhancement 5.4): a store's (BROADCAST_IMAGE, decided on the
 * caller's membership: `manage_broadcasts`), the platform's (PLATFORM_BROADCAST_IMAGE, CREATE:BROADCAST, for
 * yourself), and that neither is deleted while a broadcast still names it.
 */
@Injectable()
export class NotificationsFileRegistrations implements OnModuleInit {
	public constructor(
		private readonly access: FileCategoryAccessRegistry,
		@Inject(FileReferenceGuardRegistry) private readonly guards: FileReferenceGuardRegistry<Prisma.TransactionClient>,
		@Inject(TENANT_FILE_ACCESS) private readonly tenantFiles: TenantFileAccessPort,
		@Inject(AUTHORIZATION_KERNEL) private readonly kernel: AuthorizationKernelPort,
	) {}

	public onModuleInit(): void {
		this.access.register(
			this.tenantFiles.ruleFor(["BROADCAST_IMAGE"], {
				manage: MERCHANT_CAPABILITY.manageBroadcasts,
				read: MERCHANT_CAPABILITY.manageBroadcasts,
				deniedMessage: "Your tenant role cannot write broadcasts",
			}),
		);
		this.access.register(new PlatformBroadcastImageFileAccessRule(this.kernel));
		this.guards.register(bindFileReferenceGuard(new BroadcastImageInUseGuard(), new BroadcastImageUseScopeFactory()));
	}
}
