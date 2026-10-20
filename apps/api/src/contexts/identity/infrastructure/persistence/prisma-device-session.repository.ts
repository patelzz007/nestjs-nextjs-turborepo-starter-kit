import type { Prisma, RefreshToken } from "@prisma/client";
import { epochMs, type EpochMs } from "@workspace/shared";

import { DeviceSession, type DeviceSessionState, type LiveSessionSummary } from "../../domain/aggregates/device-session.aggregate";
import type { DeviceSessionRepository, OwnSessionRevocation, RotationWrite } from "../../domain/repositories/device-session.repository";
import { sessionRevokerColumn, type SessionRevoker } from "../../domain/value-objects/session-revoker.value-object";

/** The soft-delete write of a revocation. `rotationVersion` moves too, so a concurrent rotation's compare-and-set can never resurrect the row. */
function revocationData(revoker: SessionRevoker, now: EpochMs): Prisma.RefreshTokenUpdateManyMutationInput {
	return { isDeleted: true, deletedAt: now, deletedBy: sessionRevokerColumn(revoker), rotationVersion: { increment: 1 }, updatedAt: now };
}

export function toDeviceSessionState(row: RefreshToken): DeviceSessionState {
	return {
		id: row.id,
		userId: row.userId,
		tokenHash: row.token,
		previousTokenHash: row.previousTokenHash,
		device:
			row.clientType === null || row.deviceType === null
				? null
				: {
						clientType: row.clientType,
						browserName: row.browserName,
						browserVersion: row.browserVersion,
						osName: row.osName,
						osVersion: row.osVersion,
						deviceType: row.deviceType,
						deviceModel: row.deviceModel,
						deviceName: row.deviceName,
						appVersion: row.appVersion,
					},
		signInMethod: row.signInMethod,
		ipAddress: row.ipAddress,
		lastIpAddress: row.lastIpAddress,
		location: row.locationCountry === null ? null : { country: row.locationCountry, region: row.locationRegion, city: row.locationCity },
		createdAt: epochMs(Number(row.createdAt)),
		lastActiveAt: epochMs(Number(row.lastActiveAt)),
		expiresAt: epochMs(Number(row.expiresAt)),
		isDeleted: row.isDeleted,
		updatedAt: epochMs(Number(row.updatedAt)),
	};
}

export class PrismaDeviceSessionRepository implements DeviceSessionRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async findById(id: string): Promise<DeviceSession | null> {
		const row = await this.db.refreshToken.findUnique({ where: { id } });
		return row === null ? null : DeviceSession.rehydrate(toDeviceSessionState(row));
	}

	public async add(session: DeviceSession): Promise<void> {
		const state = session.snapshot;
		await this.db.refreshToken.create({
			data: {
				id: state.id,
				userId: state.userId,
				token: state.tokenHash,
				clientType: state.device?.clientType ?? null,
				browserName: state.device?.browserName ?? null,
				browserVersion: state.device?.browserVersion ?? null,
				osName: state.device?.osName ?? null,
				osVersion: state.device?.osVersion ?? null,
				deviceType: state.device?.deviceType ?? null,
				deviceModel: state.device?.deviceModel ?? null,
				deviceName: state.device?.deviceName ?? null,
				appVersion: state.device?.appVersion ?? null,
				signInMethod: state.signInMethod,
				ipAddress: state.ipAddress,
				lastIpAddress: state.lastIpAddress,
				locationCountry: state.location?.country ?? null,
				locationRegion: state.location?.region ?? null,
				locationCity: state.location?.city ?? null,
				lastActiveAt: state.lastActiveAt,
				expiresAt: state.expiresAt,
				createdAt: state.createdAt,
				updatedAt: state.updatedAt,
			},
		});
	}

	public async saveRotation(session: DeviceSession, expectedTokenHash: string, now: EpochMs): Promise<RotationWrite> {
		const rotation = session.rotation;
		if (rotation === null) {
			return { kind: "rotated" };
		}
		const updated = await this.db.refreshToken.updateMany({
			where: { id: session.id, token: expectedTokenHash, isDeleted: false, expiresAt: { gte: now } },
			data: {
				previousTokenHash: expectedTokenHash,
				token: rotation.tokenHash,
				expiresAt: rotation.expiresAt,
				lastActiveAt: rotation.rotatedAt,
				...(rotation.lastIpAddress === null ? {} : { lastIpAddress: rotation.lastIpAddress }),
				rotationVersion: { increment: 1 },
				updatedAt: rotation.rotatedAt,
			},
		});
		if (updated.count === 1) {
			return { kind: "rotated" };
		}
		const current = await this.db.refreshToken.findUnique({ where: { id: session.id } });
		return { kind: "lost", current: current === null ? null : toDeviceSessionState(current) };
	}

	public async liveSessionsOf(userId: string): Promise<readonly LiveSessionSummary[]> {
		const rows = await this.db.refreshToken.findMany({ where: { userId, isDeleted: false }, select: { id: true, createdAt: true, expiresAt: true } });
		return rows.map((row): LiveSessionSummary => ({ id: row.id, createdAt: epochMs(Number(row.createdAt)), expiresAt: epochMs(Number(row.expiresAt)) }));
	}

	public async revokeSessions(sessionIds: readonly string[], revoker: SessionRevoker, now: EpochMs): Promise<void> {
		if (sessionIds.length === 0) {
			return;
		}
		await this.db.refreshToken.updateMany({ where: { id: { in: [...sessionIds] }, isDeleted: false }, data: revocationData(revoker, now) });
	}

	public async revokeAllOf(userIds: readonly string[], revoker: SessionRevoker, now: EpochMs, keepSessionId: string | null): Promise<void> {
		if (userIds.length === 0) {
			return;
		}
		await this.db.refreshToken.updateMany({
			where: { userId: { in: [...userIds] }, isDeleted: false, ...(keepSessionId === null ? {} : { id: { not: keepSessionId } }) },
			data: revocationData(revoker, now),
		});
	}

	public async revokeOwn(sessionId: string, userId: string, revoker: SessionRevoker, now: EpochMs): Promise<OwnSessionRevocation> {
		const revoked = await this.db.refreshToken.updateMany({ where: { id: sessionId, userId, isDeleted: false }, data: revocationData(revoker, now) });
		if (revoked.count === 1) {
			return "revoked";
		}
		const owned = await this.db.refreshToken.findFirst({ where: { id: sessionId, userId }, select: { id: true } });
		return owned === null ? "not_found" : "already_revoked";
	}
}
