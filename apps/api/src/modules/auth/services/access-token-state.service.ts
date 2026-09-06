import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";

/** Cached account state used to reject stale or revoked access tokens. */
export interface AccessTokenAccountState {
	readonly tokenVersion: number;
	readonly isActive: boolean;
	readonly isDeleted: boolean;
}

interface CacheEntry {
	readonly value: AccessTokenAccountState;
	readonly expiresAt: number;
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
	private readonly logger: Logger = new Logger(AccessTokenStateService.name);
	private readonly store = new Map<string, CacheEntry>();
	private readonly ttlMs: number = 30_000;

	public constructor(private readonly prisma: PrismaService) {}

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
		if (cached !== undefined && Date.now() <= cached.expiresAt) {
			return cached.value;
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

		this.store.set(userId, { value, expiresAt: Date.now() + this.ttlMs });
		return value;
	}
}
