import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { bindInTransactionHandler } from "../../../../platform/application/events/in-transaction-event-handler";
import { InTransactionEventRegistry } from "../../../../platform/application/events/in-transaction-event-registry";
import { FileCategoryAccessRegistry } from "../../../files/public-api";
import { BindUserAvatarOnFileVerdict } from "../../application/event-handlers/in-transaction/bind-user-avatar-on-file-verdict.in-transaction-handler";
import { ReleaseUserAvatarOnFileDeleted } from "../../application/event-handlers/in-transaction/release-user-avatar-on-file-deleted.in-transaction-handler";
import { UserAvatarFileAccessRule } from "../../application/services/user-avatar-file-access.rule";
import { UserAvatarFileScopeFactory } from "./prisma-user-avatar-bindings";

/**
 * Identity owns USER_AVATAR's meaning: who may upload one, and the avatar row a
 * READY file becomes (bound and released in the files transaction, mechanism 1).
 */
@Injectable()
export class IdentityFileRegistrations implements OnModuleInit {
	public constructor(
		private readonly access: FileCategoryAccessRegistry,
		@Inject(InTransactionEventRegistry) private readonly handlers: InTransactionEventRegistry<Prisma.TransactionClient>,
	) {}

	public onModuleInit(): void {
		const scopes = new UserAvatarFileScopeFactory();
		this.access.register(new UserAvatarFileAccessRule());
		this.handlers.register(bindInTransactionHandler(new BindUserAvatarOnFileVerdict(), scopes));
		this.handlers.register(bindInTransactionHandler(new ReleaseUserAvatarOnFileDeleted(), scopes));
	}
}
