import { Injectable } from "@nestjs/common";
import type { Prisma, RefreshToken } from "@prisma/client";

import { epochMs, nowEpochMs, type AuthClientType, type DeviceType, type EpochMs, type SessionLocation, type SessionSignInMethod } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";
import { REFRESH_SUPERSEDED_GRACE_MS } from "../constants/refresh-token-rotation.constants";
import type { SessionDeviceDetails } from "../device/session-device";
import { revokedBySystem, sessionRevokerColumn, type SessionRevoker } from "../device/session-revoker";

/** One active device session as the device list shows it (every column of docs/technical/mobile/mobile-app.md §8.2). */
export interface DeviceSessionRecord {
	readonly id: string;
	readonly clientType: AuthClientType | null;
	readonly browserName: string | null;
	readonly browserVersion: string | null;
	readonly osName: string | null;
	readonly osVersion: string | null;
	readonly deviceType: DeviceType | null;
	readonly deviceModel: string | null;
	readonly deviceName: string | null;
	readonly appVersion: string | null;
	readonly signInMethod: SessionSignInMethod | null;
	readonly ipAddress: string | null;
	readonly lastIpAddress: string | null;
	readonly location: SessionLocation | null;
	readonly createdAt: EpochMs;
	readonly lastActiveAt: EpochMs;
	readonly expiresAt: EpochMs;
}

/** A new device session (one sign-in). The id is chosen by the caller: it is the `jti` / `sid` the tokens are signed with. */
export interface NewDeviceSession {
	readonly id: string;
	readonly userId: string;
	/** Digest of the refresh token (`CryptoService.hashRefreshToken`) — never the token itself. */
	readonly tokenHash: string;
	readonly device: SessionDeviceDetails;
	readonly ipAddress: string | null;
	readonly location: SessionLocation | null;
	readonly signInMethod: SessionSignInMethod;
	readonly createdAt: EpochMs;
	readonly expiresAt: EpochMs;
}

/** What one refresh rotation writes: the new token, its expiry, and the activity of the refreshing request. */
export interface SessionRotation {
	readonly token: string;
	readonly expiresAt: EpochMs;
	/** IP of the refreshing request; `null` (unknown) keeps the previous value. */
	readonly lastIpAddress: string | null;
}

/**
 * Outcome of {@link RefreshTokenRepository.rotateTokenIfHashMatches}:
 * - `rotated` — this call rotated the token.
 * - `superseded` — a concurrent request rotated it first and the presented
 *   token is the IMMEDIATE predecessor of the new one, within
 *   {@link REFRESH_SUPERSEDED_GRACE_MS} (a benign race).
 * - `reused` — the token moved on, and the presented token is not its immediate
 *   predecessor inside the grace window: treat as token theft.
 * - `missing` — the session is gone (revoked, expired, or deleted).
 */
export type RotateTokenResult = "rotated" | "superseded" | "reused" | "missing";

/**
 * Outcome of {@link RefreshTokenRepository.revokeOwnSession}:
 * - `revoked` — this call revoked the caller's live session;
 * - `already_revoked` — the session is the caller's but was revoked before (idempotent success);
 * - `not_found` — no session with that id belongs to the caller.
 */
export type SessionRevocationOutcome = "revoked" | "already_revoked" | "not_found";

/** Device sessions a user keeps at once; signing in again retires the oldest beyond it (`system:session-limit`). */
export const MAX_ACTIVE_SESSIONS_PER_USER = 5;

/** The device-list columns of a session row. */
const DEVICE_SESSION_SELECT = {
	id: true,
	clientType: true,
	browserName: true,
	browserVersion: true,
	osName: true,
	osVersion: true,
	deviceType: true,
	deviceModel: true,
	deviceName: true,
	appVersion: true,
	signInMethod: true,
	ipAddress: true,
	lastIpAddress: true,
	locationCountry: true,
	locationRegion: true,
	locationCity: true,
	createdAt: true,
	lastActiveAt: true,
	expiresAt: true,
} satisfies Prisma.RefreshTokenSelect;

type DeviceSessionRow = Prisma.RefreshTokenGetPayload<{ select: typeof DEVICE_SESSION_SELECT }>;

function toDeviceSessionRecord(row: DeviceSessionRow): DeviceSessionRecord {
	return {
		id: row.id,
		clientType: row.clientType,
		browserName: row.browserName,
		browserVersion: row.browserVersion,
		osName: row.osName,
		osVersion: row.osVersion,
		deviceType: row.deviceType,
		deviceModel: row.deviceModel,
		deviceName: row.deviceName,
		appVersion: row.appVersion,
		signInMethod: row.signInMethod,
		ipAddress: row.ipAddress,
		lastIpAddress: row.lastIpAddress,
		location: row.locationCountry === null ? null : { country: row.locationCountry, region: row.locationRegion, city: row.locationCity },
		createdAt: epochMs(Number(row.createdAt)),
		lastActiveAt: epochMs(Number(row.lastActiveAt)),
		expiresAt: epochMs(Number(row.expiresAt)),
	};
}

/** The soft-delete write of a revocation. `rotationVersion` moves too, so a concurrent rotation's compare-and-set can never resurrect the row. */
function revocationData(revoker: SessionRevoker, now: number): Prisma.RefreshTokenUpdateManyMutationInput {
	return { isDeleted: true, deletedAt: now, deletedBy: sessionRevokerColumn(revoker), rotationVersion: { increment: 1 }, updatedAt: now };
}

@Injectable()
export class RefreshTokenRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async findByIdIncludingDeleted(id: string): Promise<RefreshToken | null> {
		return this.prisma.refreshToken.findUnique({ where: { id } });
	}

	/** Stores one sign-in as a device session, with every device detail (§8.2). */
	public async createSession(session: NewDeviceSession): Promise<void> {
		await this.prisma.refreshToken.create({
			data: {
				id: session.id,
				userId: session.userId,
				token: session.tokenHash,
				clientType: session.device.clientType,
				browserName: session.device.browserName,
				browserVersion: session.device.browserVersion,
				osName: session.device.osName,
				osVersion: session.device.osVersion,
				deviceType: session.device.deviceType,
				deviceModel: session.device.deviceModel,
				deviceName: session.device.deviceName,
				appVersion: session.device.appVersion,
				signInMethod: session.signInMethod,
				ipAddress: session.ipAddress,
				lastIpAddress: session.ipAddress,
				locationCountry: session.location?.country ?? null,
				locationRegion: session.location?.region ?? null,
				locationCity: session.location?.city ?? null,
				lastActiveAt: session.createdAt,
				expiresAt: session.expiresAt,
				createdAt: session.createdAt,
				updatedAt: session.createdAt,
			},
		});
	}

	/**
	 * The sweep at sign-in, in one transaction: every live session past its
	 * expiry is retired (`system:expired-cleanup`), then every live session
	 * beyond the newest {@link MAX_ACTIVE_SESSIONS_PER_USER} (`system:session-limit`).
	 * Already revoked sessions are never touched, so their `deletedBy` stays.
	 * Returns the ids it retired.
	 */
	public async retireStaleSessions(userId: string): Promise<readonly string[]> {
		const now: number = nowEpochMs();
		return this.prisma.$transaction(async (tx: Prisma.TransactionClient): Promise<readonly string[]> => {
			const expired = await tx.refreshToken.findMany({ where: { userId, isDeleted: false, expiresAt: { lt: now } }, select: { id: true } });
			const expiredIds: string[] = expired.map((row): string => row.id);
			if (expiredIds.length > 0) {
				await tx.refreshToken.updateMany({ where: { id: { in: expiredIds }, isDeleted: false }, data: revocationData(revokedBySystem("system:expired-cleanup"), now) });
			}

			const excess = await tx.refreshToken.findMany({
				where: { userId, isDeleted: false },
				orderBy: [{ createdAt: "desc" }, { id: "asc" }],
				skip: MAX_ACTIVE_SESSIONS_PER_USER,
				select: { id: true },
			});
			const excessIds: string[] = excess.map((row): string => row.id);
			if (excessIds.length > 0) {
				await tx.refreshToken.updateMany({ where: { id: { in: excessIds }, isDeleted: false }, data: revocationData(revokedBySystem("system:session-limit"), now) });
			}
			return [...expiredIds, ...excessIds];
		});
	}

	/** The user's active sessions (live, not expired) with every device detail, newest sign-in first. */
	public async listActiveSessionsForUser(userId: string): Promise<DeviceSessionRecord[]> {
		const rows = await this.prisma.refreshToken.findMany({
			where: { userId, isDeleted: false, expiresAt: { gte: nowEpochMs() } },
			orderBy: { createdAt: "desc" },
			select: DEVICE_SESSION_SELECT,
		});
		return rows.map(toDeviceSessionRecord);
	}

	/**
	 * Atomically rotate a refresh token only when the stored hash still matches
	 * (compare-and-set) and the session is live. The row is updated IN PLACE, so
	 * its id — the session id (`sid`) — and every device detail carry forward;
	 * only the token, the expiry and the activity (`lastActiveAt`,
	 * `lastIpAddress`) change. See {@link RotateTokenResult} for the outcomes.
	 * `onRotated` (the caller's outbox event) runs inside the same transaction,
	 * only when this call performed the rotation.
	 */
	public async rotateTokenIfHashMatches(
		id: string,
		expectedTokenHash: string,
		rotation: SessionRotation,
		onRotated: (tx: Prisma.TransactionClient) => Promise<void>,
	): Promise<RotateTokenResult> {
		const now: number = nowEpochMs();

		return this.prisma.$transaction(async (tx): Promise<RotateTokenResult> => {
			const updated = await tx.refreshToken.updateMany({
				where: {
					id,
					token: expectedTokenHash,
					isDeleted: false,
					expiresAt: { gte: now },
				},
				data: {
					previousTokenHash: expectedTokenHash,
					token: rotation.token,
					expiresAt: rotation.expiresAt,
					lastActiveAt: now,
					...(rotation.lastIpAddress === null ? {} : { lastIpAddress: rotation.lastIpAddress }),
					rotationVersion: { increment: 1 },
					updatedAt: now,
				},
			});

			if (updated.count === 1) {
				await onRotated(tx);
				return "rotated";
			}

			const current = await tx.refreshToken.findUnique({ where: { id } });
			if (current === null || current.isDeleted) {
				return "missing";
			}

			if (current.token === expectedTokenHash) {
				// Same hash, but the conditional update did not match: the token expired.
				return "missing";
			}

			const isImmediatePredecessor: boolean = current.previousTokenHash === expectedTokenHash;
			const isWithinGrace: boolean = current.updatedAt >= now - REFRESH_SUPERSEDED_GRACE_MS;
			return isImmediatePredecessor && isWithinGrace ? "superseded" : "reused";
		});
	}

	/** Soft-delete every live session of `userIds`, recording who revoked them (pass `db` to join a caller's transaction). */
	public async revokeAllForUsers(userIds: readonly string[], revoker: SessionRevoker, db: Prisma.TransactionClient = this.prisma): Promise<void> {
		if (userIds.length === 0) {
			return;
		}
		await db.refreshToken.updateMany({
			where: { userId: { in: [...userIds] }, isDeleted: false },
			data: revocationData(revoker, nowEpochMs()),
		});
	}

	/**
	 * Soft-delete one session of `userId` (sign out, or revoke from the device
	 * list), recording `revoker` as its `deletedBy`. Race-safe with a concurrent
	 * refresh: both are conditional updates of the same row on `isDeleted =
	 * false`, so whichever commits second sees the other's result — a refresh
	 * that loses finds the row revoked (`missing` → 401), and a revoke that loses
	 * still revokes the rotated row.
	 *
	 * `withinTransaction` (the caller's outbox event) runs, in the same
	 * transaction, only when this call revoked the session. See
	 * {@link SessionRevocationOutcome}.
	 */
	public async revokeOwnSession(
		id: string,
		userId: string,
		revoker: SessionRevoker,
		withinTransaction: (tx: Prisma.TransactionClient) => Promise<void>,
	): Promise<SessionRevocationOutcome> {
		const now: number = nowEpochMs();
		return this.prisma.$transaction(async (tx): Promise<SessionRevocationOutcome> => {
			const revoked = await tx.refreshToken.updateMany({
				where: { id, userId, isDeleted: false },
				data: revocationData(revoker, now),
			});
			if (revoked.count === 1) {
				await withinTransaction(tx);
				return "revoked";
			}
			const owned = await tx.refreshToken.findFirst({ where: { id, userId }, select: { id: true } });
			return owned === null ? "not_found" : "already_revoked";
		});
	}
}
