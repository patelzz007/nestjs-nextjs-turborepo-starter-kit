import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";

import { AuthorizationEventEmitter } from "../../authorization/events/authorization.events";
import { IdentityService } from "../services/identity.service";

/**
 * Clears the short-lived `/auth/me` response cache when authorization state
 * changes for a user (roles, direct permissions, or inherited role permissions).
 */
@Injectable()
export class AuthMeCacheListener implements OnModuleInit, OnModuleDestroy {
	private unsubscribeUsersMeInvalidate: (() => void) | undefined;

	public constructor(
		private readonly events: AuthorizationEventEmitter,
		private readonly identity: IdentityService,
	) {}

	public onModuleInit(): void {
		const unsubscribe = this.events.onUsersMeInvalidate((event) => {
			for (const userId of event.userIds) {
				this.identity.invalidateMe(userId);
			}
		});
		this.unsubscribeUsersMeInvalidate = unsubscribe;
	}

	public onModuleDestroy(): void {
		this.unsubscribeUsersMeInvalidate?.();
		this.unsubscribeUsersMeInvalidate = undefined;
	}
}
