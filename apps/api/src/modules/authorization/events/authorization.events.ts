import { Injectable, Logger } from "@nestjs/common";

/**
 * Events emitted when authorization state changes.
 */
export interface RoleChangedEvent {
	readonly type: "created" | "updated" | "deleted" | "restored" | "permission_synced";
	readonly roleId: string;
	readonly roleName: string;
	readonly actorId: string;
}

export interface PermissionChangedEvent {
	readonly type: "created" | "updated" | "deleted" | "restored";
	readonly permissionId: string;
	readonly action: string;
	readonly resource: string;
	readonly actorId: string;
}

export interface UserRoleChangedEvent {
	readonly type: "assigned" | "removed" | "synced";
	readonly userId: string;
	readonly roleId: string;
	readonly actorId: string;
}

export interface UserPermissionChangedEvent {
	readonly type: "granted" | "revoked" | "synced" | "expired";
	readonly userId: string;
	readonly permissionId: string;
	readonly actorId: string;
}

/** Emitted when `/auth/me` cache should be cleared for one or more users. */
export interface UsersMeInvalidateEvent {
	readonly userIds: readonly string[];
}

export const AuthorizationEvents = {
	ROLE_CHANGED: "authorization.role.changed",
	PERMISSION_CHANGED: "authorization.permission.changed",
	USER_ROLE_CHANGED: "authorization.user_role.changed",
	USER_PERMISSION_CHANGED: "authorization.user_permission.changed",
	USERS_ME_INVALIDATE: "authorization.users.me.invalidate",
};

/** Event handler function type. */
type EventHandler<T> = (event: T) => void;

/**
 * Lightweight in-memory event emitter for authorization changes.
 *
 * Any service can subscribe with `emitter.on(AuthorizationEvents.ROLE_CHANGED, handler)`.
 */
@Injectable()
export class AuthorizationEventEmitter {
	private readonly logger: Logger = new Logger(AuthorizationEventEmitter.name);

	private readonly roleHandlers: EventHandler<RoleChangedEvent>[] = [];
	private readonly permissionHandlers: EventHandler<PermissionChangedEvent>[] = [];
	private readonly userRoleHandlers: EventHandler<UserRoleChangedEvent>[] = [];
	private readonly userPermissionHandlers: EventHandler<UserPermissionChangedEvent>[] = [];
	private readonly usersMeInvalidateHandlers: EventHandler<UsersMeInvalidateEvent>[] = [];

	/** Subscribe to role change events. */
	public onRoleChanged(handler: EventHandler<RoleChangedEvent>): void {
		this.roleHandlers.push(handler);
	}

	/** Subscribe to permission change events. */
	public onPermissionChanged(handler: EventHandler<PermissionChangedEvent>): void {
		this.permissionHandlers.push(handler);
	}

	/** Subscribe to user-role change events. */
	public onUserRoleChanged(handler: EventHandler<UserRoleChangedEvent>): void {
		this.userRoleHandlers.push(handler);
	}

	/** Subscribe to user-permission change events. */
	public onUserPermissionChanged(handler: EventHandler<UserPermissionChangedEvent>): void {
		this.userPermissionHandlers.push(handler);
	}

	/** Subscribe to `/auth/me` cache invalidation events. Returns unsubscribe for `onModuleDestroy`. */
	public onUsersMeInvalidate(handler: EventHandler<UsersMeInvalidateEvent>): () => void {
		this.usersMeInvalidateHandlers.push(handler);
		return (): void => {
			const index = this.usersMeInvalidateHandlers.indexOf(handler);
			if (index >= 0) {
				this.usersMeInvalidateHandlers.splice(index, 1);
			}
		};
	}

	public emitRoleChanged(event: RoleChangedEvent): void {
		for (const handler of this.roleHandlers) {
			try {
				handler(event);
			} catch (error) {
				this.logger.error(`Role event handler failed: ${error instanceof Error ? error.message : "unknown"}`);
			}
		}
		this.logger.debug(`Emitted role changed: ${event.type} ${event.roleName}`);
	}

	public emitPermissionChanged(event: PermissionChangedEvent): void {
		for (const handler of this.permissionHandlers) {
			try {
				handler(event);
			} catch (error) {
				this.logger.error(`Permission event handler failed: ${error instanceof Error ? error.message : "unknown"}`);
			}
		}
		this.logger.debug(`Emitted permission changed: ${event.type} ${event.action}:${event.resource}`);
	}

	public emitUserRoleChanged(event: UserRoleChangedEvent): void {
		for (const handler of this.userRoleHandlers) {
			try {
				handler(event);
			} catch (error) {
				this.logger.error(`UserRole event handler failed: ${error instanceof Error ? error.message : "unknown"}`);
			}
		}
	}

	public emitUserPermissionChanged(event: UserPermissionChangedEvent): void {
		for (const handler of this.userPermissionHandlers) {
			try {
				handler(event);
			} catch (error) {
				this.logger.error(`UserPermission event handler failed: ${error instanceof Error ? error.message : "unknown"}`);
			}
		}
	}

	public emitUsersMeInvalidate(userIds: readonly string[]): void {
		if (userIds.length === 0) {
			return;
		}
		const event: UsersMeInvalidateEvent = { userIds };
		for (const handler of this.usersMeInvalidateHandlers) {
			try {
				handler(event);
			} catch (error) {
				this.logger.error(`UsersMeInvalidate event handler failed: ${error instanceof Error ? error.message : "unknown"}`);
			}
		}
	}
}
