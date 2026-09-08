import { Injectable, UnauthorizedException } from "@nestjs/common";
import { BoundedTtlCache } from "@workspace/shared";

import { TypedConfigService } from "../../../config/typed-config.service";
import { PrismaService } from "../../../prisma/prisma.service";

/** Cached account state used to reject stale or revoked access tokens. */
export interface AccessTokenAccountState {
	readonly tokenVersion: number;
	readonly isActive: boolean;
	readonly isDeleted: boolean;
}

/**
 * Short-lived cache of account revocation state for access-token validation.
 *
 * Every authenticated request checks `tokenVersion`, `isActive`, and
 * `isDeleted` so password resets and session revocations take effect
 * without waiting for JWT expiry.
 */
@Injectable()
export class AccessTokenStateService {
	private readonly store: BoundedTtlCache<string, AccessTokenAccountState>;
	private readonly ttlMs: number;

	public constructor(
		private readonly prisma: PrismaService,
		config: TypedConfigService,
	) {
		this.ttlMs = config.accessTokenStateCacheTtlMs;
		this.store = new BoundedTtlCache<string, AccessTokenAccountState>({
			maxEntries: config.accessTokenStateCacheMaxEntries,
			defaultTtlMs: this.ttlMs,
			capacityPolicy: "evict-oldest",
		});
	}

	public async assertTokenValid(userId: string, tokenVersion: number): Promise<void> {
		const state = await this.getAccountState(userId);

		if (state.isDeleted) {
			throw new UnauthorizedException({
				message: "Account has been deleted. Please contact support.",
				error: "ACCOUNT_DELETED",
			});
		}

		if (!state.isActive) {
			throw new UnauthorizedException({
				message: "Account is inactive. Please contact support.",
				error: "ACCOUNT_IS_INACTIVE",
			});
		}

		if (state.tokenVersion !== tokenVersion) {
			throw new UnauthorizedException({
				message: "Token revoked — please sign in again",
				error: "TOKEN_VERSION_MISMATCH",
			});
		}
	}

	public invalidate(userId: string): void {
		this.store.delete(userId);
	}

	public async bumpTokenVersion(userId: string): Promise<number> {
		this.invalidate(userId);
		const updated = await this.prisma.user.update({
			where: { id: userId },
			data: { tokenVersion: { increment: 1 }, updatedAt: Date.now() },
			select: { tokenVersion: true },
		});
		return updated.tokenVersion;
	}

	private async getAccountState(userId: string): Promise<AccessTokenAccountState> {
		const cached = this.store.get(userId);
		if (cached !== null) {
			return cached;
		}

		const user = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { tokenVersion: true, isActive: true, isDeleted: true },
		});

		if (user === null) {
			throw new UnauthorizedException({
				message: "User account no longer exists. Please sign in again.",
				error: "USER_NOT_FOUND",
			});
		}

		const value: AccessTokenAccountState = {
			tokenVersion: user.tokenVersion,
			isActive: user.isActive,
			isDeleted: user.isDeleted,
		};

		this.store.set(userId, value, this.ttlMs);
		return value;
	}
}
