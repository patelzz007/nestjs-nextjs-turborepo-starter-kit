import { randomUUID } from "node:crypto";

import { CommandBus } from "@nestjs/cqrs";
import { JwtService } from "@nestjs/jwt";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import type { ImpersonateServiceResponse } from "@workspace/shared";
import type { Pool } from "pg";

import { TypedConfigService } from "../../src/config/typed-config.service";
import { ActorContextSchema, type ActorContext } from "../../src/platform/application/actor-context";
import { StartImpersonationCommand } from "../../src/contexts/identity/application/commands/start-impersonation/start-impersonation.command";

/**
 * Starts an impersonation session the way `POST /auth/impersonate/:userId` does, without a SuperAdmin
 * login: the SuperAdmin's actor (a fresh MFA step-up, a full session) dispatches the same command.
 *
 * An administrator may hold only one live impersonation session (D36), so the SuperAdmin's sessions
 * left live by earlier tests are ended first (fixture reset through the superuser pool), keeping every
 * test independent of the ones before it.
 */
export async function startImpersonation(app: NestFastifyApplication, pool: Pool, superAdminId: string, targetUserId: string): Promise<ImpersonateServiceResponse> {
	await pool.query(
		`UPDATE public."ImpersonationSession" SET "endedAt" = $2, "endedBy" = "impersonatorId", "endReason" = 'STOPPED' WHERE "impersonatorId" = $1 AND "endedAt" IS NULL`,
		[superAdminId, Date.now()],
	);
	const actor: ActorContext = ActorContextSchema.parse({
		kind: "user",
		userId: superAdminId,
		sessionId: randomUUID(),
		organizationId: null,
		isSuperAdmin: true,
		accessScope: "superadmin",
		impersonatorUserId: null,
		request: { requestId: randomUUID(), ip: null, userAgent: null, deviceLabel: null, endpoint: null },
	});
	return app.get(CommandBus).execute(new StartImpersonationCommand(actor, { targetUserId, mfaAssuredAt: Date.now(), ipAddress: null, userAgent: null }));
}

/** How long the administrator's fixture device session lives: long enough for any one test. */
const ADMIN_DEVICE_SESSION_TTL_MS = 3_600_000;
const MS_PER_SECOND = 1000;

/**
 * Opens a live device session for the administrator (a `RefreshToken` row through the superuser
 * pool) and signs its refresh token, as a sign-in would. Stopping an impersonation binds the restored
 * admin token to the session the presented refresh token names, so the stop request carries it.
 */
export async function openAdminDeviceSession(app: NestFastifyApplication, pool: Pool, userId: string): Promise<{ readonly sessionId: string; readonly refreshToken: string }> {
	const sessionId: string = randomUUID();
	const expiresAt: number = Date.now() + ADMIN_DEVICE_SESSION_TTL_MS;
	await pool.query(`INSERT INTO public."RefreshToken" (id, token, "userId", "expiresAt", "clientType") VALUES ($1, $2, $3, $4, 'web')`, [
		sessionId,
		`e2e-fixture-${sessionId}`,
		userId,
		expiresAt,
	]);
	const refreshToken: string = await app
		.get(JwtService)
		.signAsync(
			{ sub: userId, email: "superadmin@example.com", jti: sessionId, tokenType: "refresh", nonce: randomUUID() },
			{ secret: app.get(TypedConfigService).auth.jwtRefreshSecret, expiresIn: ADMIN_DEVICE_SESSION_TTL_MS / MS_PER_SECOND },
		);
	return { sessionId, refreshToken };
}
