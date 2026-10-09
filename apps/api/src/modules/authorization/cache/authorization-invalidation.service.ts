import { randomUUID } from "node:crypto";

import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type Redis from "ioredis";
import { z } from "zod";

import { ThrownErrorSchema } from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";
import { REDIS_PUBLISHER, REDIS_SUBSCRIBER } from "../../../infrastructure/redis/redis.tokens";
import { AccessTokenStateService } from "../../auth/services/access-token-state.service";

import { AuthorizationCacheService } from "./authorization-cache.service";

/**
 * Redis pub/sub channel (inside the REDIS_NAMESPACE — the full channel is
 * `<namespace>:authz:invalidate`) every API instance of one deployment
 * listens on for authorization invalidations.
 */
export const AUTHORIZATION_INVALIDATION_CHANNEL = "authz:invalidate";

/** Upper bound on user ids per message (an RBAC change touching more is split into several messages). */
export const MAX_USER_IDS_PER_INVALIDATION_MESSAGE = 1_000;

const MAX_ID_LENGTH = 128;

/** How many user ids a debug line lists before summarising the rest as "+N more". */
const MAX_USER_IDS_PER_LOG_LINE = 10;

/**
 * WHY a set of users' authorization state was invalidated — carried on the
 * pub/sub message so every instance's debug line names the action behind it.
 */
export const UserInvalidationTriggerSchema = z.enum([
	/** An RBAC mutation (role/permission/assignment change) committed — see the permission audit log. */
	"rbac_mutation",
	/** The user signed out of every device. */
	"logout_all_devices",
	/** One device session was revoked (signed out, or revoked from the device list — ADR 034): its `sid` is rejected from now on. */
	"session_revoked",
	/** A rotated refresh token was replayed (theft signal): every session was revoked. */
	"refresh_token_reuse",
	/** The user changed their password. */
	"password_changed",
	/** The user completed a password reset. */
	"password_reset",
	/** An approved MFA recovery reached its scheduled unlock. */
	"mfa_recovery_completed",
]);
export type UserInvalidationTrigger = z.output<typeof UserInvalidationTriggerSchema>;

const InvalidationMessageSchema = z.discriminatedUnion("type", [
	z
		.object({
			type: z.literal("users"),
			origin: z.string().max(MAX_ID_LENGTH),
			userIds: z.array(z.string().min(1).max(MAX_ID_LENGTH)).min(1).max(MAX_USER_IDS_PER_INVALIDATION_MESSAGE),
			/** Also drop the cached access-token state (tokenVersion / active flags) — set after a session revocation. */
			accessTokenState: z.boolean(),
			trigger: UserInvalidationTriggerSchema,
		})
		.strict(),
	z.object({ type: z.literal("clear"), origin: z.string().max(MAX_ID_LENGTH) }).strict(),
	z
		.object({
			type: z.literal("policy_bundles"),
			origin: z.string().max(MAX_ID_LENGTH),
			/** The organization whose bundle changed; `null` = every bundle (a platform-scope policy changed). */
			organizationId: z.string().min(1).max(MAX_ID_LENGTH).nullable(),
		})
		.strict(),
]);

type InvalidationMessage = z.output<typeof InvalidationMessageSchema>;

/** Which compiled policy bundles a policy publish made stale. */
export type PolicyBundleInvalidationScope = { readonly kind: "organization"; readonly organizationId: string } | { readonly kind: "all" };

/**
 * A per-process cache of compiled policy bundles that must be dropped when a
 * policy is published on ANY instance. Registered at module init by the
 * module that owns the cache (dependency inversion: this service never
 * imports the policy engine).
 */
export interface PolicyBundleCacheTarget {
	invalidateOrganization(organizationId: string): void;
	invalidateAll(): void;
}

/** What changed for a set of users. */
export interface UserInvalidationScope {
	/** Their sessions were revoked (tokenVersion bumped): drop cached access-token state everywhere too. */
	readonly accessTokenState: boolean;
	/** The action behind the invalidation (logged at debug level on every instance). */
	readonly trigger: UserInvalidationTrigger;
}

/** Where an applied invalidation came from: this process, or another API process on the same Redis. */
type InvalidationOrigin = { readonly kind: "local" } | { readonly kind: "remote"; readonly instanceId: string };

const LOCAL_ORIGIN: InvalidationOrigin = { kind: "local" };

/**
 * The single place authorization state is invalidated **after commit**.
 *
 * Applies the invalidation to this instance's in-process caches (the
 * authorization cache and the access-token state cache), then — when the
 * Redis authorization backend is configured — publishes it on
 * {@link AUTHORIZATION_INVALIDATION_CHANNEL} so every other API instance
 * drops the same entries. Without Redis the deployment is single-instance by
 * configuration and local invalidation is complete.
 *
 * Delivery is at-most-once (Redis pub/sub). A publish that fails after the
 * database committed cannot be rolled back; it is logged at error level and
 * the other instances converge when their entries expire
 * (`ACCESS_TOKEN_STATE_CACHE_TTL_MS`, `AUTHORIZATION_CACHE_TTL_MS`,
 * `POLICY_BUNDLE_CACHE_TTL_MS` for registered policy-bundle caches). The
 * revoked refresh tokens and bumped tokenVersion are already durable, so a
 * missed message only delays — never undoes — a revocation.
 */
@Injectable()
export class AuthorizationInvalidationService implements OnModuleInit, OnModuleDestroy {
	private readonly logger: Logger = new Logger(AuthorizationInvalidationService.name);
	/** Identifies this instance's own messages (already applied locally). */
	private readonly instanceId: string = randomUUID();
	private readonly isDistributed: boolean;
	/** `<REDIS_NAMESPACE>:authz:invalidate` — only instances sharing the namespace hear each other. */
	private readonly channel: string;
	private isSubscribed = false;
	private readonly policyBundleCaches: Set<PolicyBundleCacheTarget> = new Set<PolicyBundleCacheTarget>();

	public constructor(
		@Inject("IN_MEMORY_AUTH_CACHE") private readonly cache: AuthorizationCacheService,
		private readonly accessTokenState: AccessTokenStateService,
		config: TypedConfigService,
		@Inject(REDIS_PUBLISHER) private readonly publisher: Redis | null,
		@Inject(REDIS_SUBSCRIBER) private readonly subscriber: Redis | null,
	) {
		this.isDistributed = config.useRedisAuthorizationCache && publisher !== null && subscriber !== null;
		this.channel = config.redisNamespace.channel(AUTHORIZATION_INVALIDATION_CHANNEL);
	}

	/** Subscribe before serving traffic: an instance that cannot hear invalidations must not start. */
	public async onModuleInit(): Promise<void> {
		if (!this.isDistributed || this.subscriber === null || this.publisher === null) {
			return;
		}
		if (this.publisher.status === "wait") {
			await this.publisher.connect();
		}
		if (this.subscriber.status === "wait") {
			await this.subscriber.connect();
		}
		this.subscriber.on("message", (channel: string, payload: string): void => {
			if (channel === this.channel) {
				this.applyRemote(payload);
			}
		});
		await this.subscriber.subscribe(this.channel);
		this.isSubscribed = true;
		this.logger.log(`Listening for authorization invalidations on "${this.channel}" as instance ${this.instanceId}`);
	}

	/** The shared Redis clients are closed by the Redis infrastructure module; only our subscription ends here. */
	public async onModuleDestroy(): Promise<void> {
		if (!this.isSubscribed || this.subscriber === null) {
			return;
		}
		await this.subscriber.unsubscribe(this.channel);
		this.isSubscribed = false;
	}

	/** Drop cached authorization (and, after a session revocation, access-token state) for `userIds` on every instance. */
	public async invalidateUsers(userIds: readonly string[], scope: UserInvalidationScope): Promise<void> {
		const unique: string[] = [...new Set<string>(userIds)];
		if (unique.length === 0) {
			return;
		}
		this.applyUsers(unique, scope, LOCAL_ORIGIN);
		for (let start = 0; start < unique.length; start += MAX_USER_IDS_PER_INVALIDATION_MESSAGE) {
			await this.publish({
				type: "users",
				origin: this.instanceId,
				userIds: unique.slice(start, start + MAX_USER_IDS_PER_INVALIDATION_MESSAGE),
				accessTokenState: scope.accessTokenState,
				trigger: scope.trigger,
			});
		}
	}

	/** Drop every cached authorization entry on every instance (catalog-wide changes such as a registry sync). */
	public async clearAll(): Promise<void> {
		this.applyClear(LOCAL_ORIGIN);
		await this.publish({ type: "clear", origin: this.instanceId });
	}

	/** Registers a per-process policy-bundle cache to drop on local and remote policy publishes. */
	public registerPolicyBundleCache(target: PolicyBundleCacheTarget): void {
		this.policyBundleCaches.add(target);
	}

	/** Drop stale compiled policy bundles on every instance — call AFTER the publish transaction committed. */
	public async invalidatePolicyBundles(scope: PolicyBundleInvalidationScope): Promise<void> {
		const organizationId: string | null = scope.kind === "organization" ? scope.organizationId : null;
		this.applyPolicyBundles(organizationId);
		await this.publish({ type: "policy_bundles", origin: this.instanceId, organizationId });
	}

	private applyPolicyBundles(organizationId: string | null): void {
		for (const target of this.policyBundleCaches) {
			if (organizationId === null) {
				target.invalidateAll();
			} else {
				target.invalidateOrganization(organizationId);
			}
		}
	}

	private applyUsers(userIds: readonly string[], scope: UserInvalidationScope, origin: InvalidationOrigin): void {
		this.cache.invalidateUsers(userIds);
		if (scope.accessTokenState) {
			for (const userId of userIds) {
				this.accessTokenState.invalidate(userId);
			}
		}
		this.logger.debug(
			`Invalidated authorization cache for ${String(userIds.length)} user(s) [${describeUserIds(userIds)}]: trigger=${scope.trigger}, ` +
				`accessTokenState=${String(scope.accessTokenState)}, ${this.describeOrigin(origin)}`,
		);
	}

	private applyClear(origin: InvalidationOrigin): void {
		const entries: number = this.cache.size;
		this.cache.clear();
		this.logger.debug(`Cleared the whole authorization cache (${String(entries)} entries): ${this.describeOrigin(origin)}`);
	}

	/** `origin=this instance <id>` or `origin=remote instance <id>` — a remote id that is none of your API processes is another process sharing REDIS_URL. */
	private describeOrigin(origin: InvalidationOrigin): string {
		return origin.kind === "local" ? `origin=this instance ${this.instanceId}` : `origin=remote instance ${origin.instanceId}`;
	}

	private async publish(message: InvalidationMessage): Promise<void> {
		if (!this.isDistributed || this.publisher === null) {
			return;
		}
		try {
			await this.publisher.publish(this.channel, JSON.stringify(message));
		} catch (error) {
			// The change is committed; other instances converge at cache TTL (see class doc).
			const thrown = ThrownErrorSchema.safeParse(error);
			this.logger.error(
				`Authorization invalidation publish failed (${message.type}); other instances converge at cache TTL: ${thrown.success ? thrown.data.message : "unknown error"}`,
			);
		}
	}

	private applyRemote(payload: string): void {
		const message: InvalidationMessage | null = this.decode(payload);
		if (message === null || message.origin === this.instanceId) {
			return;
		}
		const origin: InvalidationOrigin = { kind: "remote", instanceId: message.origin };
		if (message.type === "users") {
			this.applyUsers(message.userIds, { accessTokenState: message.accessTokenState, trigger: message.trigger }, origin);
			return;
		}
		if (message.type === "policy_bundles") {
			this.applyPolicyBundles(message.organizationId);
			return;
		}
		this.applyClear(origin);
	}

	/** Pub/sub boundary: JSON text → validated message, or `null` (logged) when malformed. */
	private decode(payload: string): InvalidationMessage | null {
		try {
			const parsed = InvalidationMessageSchema.safeParse(JSON.parse(payload));
			if (parsed.success) {
				return parsed.data;
			}
		} catch (error) {
			const thrown = ThrownErrorSchema.safeParse(error);
			this.logger.error(`Rejected a non-JSON authorization invalidation message: ${thrown.success ? thrown.data.message : "unknown error"}`);
			return null;
		}
		this.logger.error("Rejected a malformed authorization invalidation message");
		return null;
	}
}

/** `id-1, id-2, … (+N more)` — bounded so a bulk invalidation stays one readable line. */
function describeUserIds(userIds: readonly string[]): string {
	const listed: string = userIds.slice(0, MAX_USER_IDS_PER_LOG_LINE).join(", ");
	const remaining: number = userIds.length - MAX_USER_IDS_PER_LOG_LINE;
	return remaining > 0 ? `${listed} (+${String(remaining)} more)` : listed;
}
