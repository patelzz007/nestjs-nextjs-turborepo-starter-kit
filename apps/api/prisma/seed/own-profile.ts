import type { Prisma } from "@prisma/client";
import { API_VERSION_PREFIX, apiRoutes, OWN_PROFILE_ERROR_CODES, OwnProfileSchema, type JsonValue } from "@workspace/shared";

import { toAuditLogCreateInput } from "../../src/common/audit/audit-log.mapper";
import { toAuditPayload } from "../../src/common/audit/http-audit-entry";
import { IMPERSONATION_TOKEN_TTL_SECONDS } from "../../src/modules/auth/constants/impersonation.constants";
import { ImpersonationAuditAction } from "../../src/modules/auth/repositories/impersonation-session.repository";
import { PROFILE_UPDATE_DURING_IMPERSONATION_MESSAGE } from "../../src/modules/auth/profile/own-profile.errors";
import { OWN_PROFILE_UPDATE_OPERATION } from "../../src/modules/auth/profile/own-profile.service";
import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { entry, NO_MACHINE_PRINCIPAL, NO_TENANT } from "./http-audit";

// ---------------------------------------------------------------------------
// Self-service profile history (`PATCH /auth/profile`) — development scenario.
//
// Seeds exactly what the API leaves behind, never a state it cannot produce:
//   - the demo customer (user@example.com) edited their own name once, so the
//     profile's optimistic-lock token `users.profile_version` is 1 — together
//     with that request's SUCCEEDED audit row (system operation
//     `auth.profile.update`, response = the profile at version 1);
//   - a SuperAdmin impersonating them tried to edit the profile and was
//     refused: a FAILED 403 `PROFILE_UPDATE_DURING_IMPERSONATION` row carrying
//     the impersonator's id and the impersonation session it ran under, and no
//     change to the profile. The session (started a minute before, stopped a
//     minute after) and its START / STOP rows are seeded with it.
// Idempotent: the version is SET (not incremented) on the account's natural key
// (email), and the audit rows are upserted by their deterministic ids with an
// empty update (append-only, like the app).
// ---------------------------------------------------------------------------

/** Demo request numbers on the shared seeded audit clock (http-audit.ts uses 0–3). */
const OWN_PROFILE_EDIT_REQUEST = 5;
const IMPERSONATED_PROFILE_EDIT_REQUEST = 6;

/** The demo customer's profile version after their one edit. */
const EDITED_PROFILE_VERSION = 1;

const PROFILE_PATH = `${API_VERSION_PREFIX}${apiRoutes.auth.profile}`;
const HTTP_OK = 200;
const HTTP_FORBIDDEN = 403;

const OWN_PROFILE_NAMESPACE = "seed.own_profile";
const MS_PER_SECOND = 1_000;
/** The impersonation started this long before the refused edit and was stopped this long after it. */
const IMPERSONATION_MARGIN_MS = 60_000;

export interface OwnProfileSeedActors {
	readonly superAdminId: string;
	/** The demo customer who edits their own profile. */
	readonly customerEmail: string;
}

export interface OwnProfileSeedSummary {
	readonly editedProfiles: number;
	readonly auditRows: number;
}

export async function seedOwnProfileHistory(actors: OwnProfileSeedActors): Promise<OwnProfileSeedSummary> {
	const customer = await prisma.user.update({
		where: { email: actors.customerEmail },
		data: { profileVersion: EDITED_PROFILE_VERSION },
		select: { id: true, email: true, fullName: true, createdAt: true, updatedAt: true },
	});
	// The response the API answered the edit with — built and validated with the endpoint's own contract.
	const editedProfile: JsonValue = OwnProfileSchema.parse({
		id: customer.id,
		email: customer.email,
		fullName: customer.fullName,
		avatar: null,
		version: EDITED_PROFILE_VERSION,
		createdAt: Number(customer.createdAt),
		updatedAt: Number(customer.updatedAt),
	});

	const impersonationSessionId: string = deterministicUuid(OWN_PROFILE_NAMESPACE, "impersonation-session");
	const rows = [
		entry(OWN_PROFILE_EDIT_REQUEST, {
			method: "PATCH",
			endpoint: PROFILE_PATH,
			path: PROFILE_PATH,
			outcome: "SUCCEEDED",
			responseStatus: HTTP_OK,
			errorCode: null,
			actorUserId: customer.id,
			impersonatorUserId: null,
			...NO_MACHINE_PRINCIPAL,
			...NO_TENANT,
			requestParams: toAuditPayload({ params: {}, query: {} }),
			requestBody: toAuditPayload({ version: EDITED_PROFILE_VERSION - 1, fullName: customer.fullName }),
			responseBody: toAuditPayload(editedProfile),
			systemOperations: [OWN_PROFILE_UPDATE_OPERATION],
		}),
		entry(IMPERSONATED_PROFILE_EDIT_REQUEST, {
			method: "PATCH",
			endpoint: PROFILE_PATH,
			path: PROFILE_PATH,
			outcome: "FAILED",
			responseStatus: HTTP_FORBIDDEN,
			errorCode: OWN_PROFILE_ERROR_CODES.PROFILE_UPDATE_DURING_IMPERSONATION,
			actorUserId: customer.id,
			impersonatorUserId: actors.superAdminId,
			...NO_MACHINE_PRINCIPAL,
			...NO_TENANT,
			requestParams: toAuditPayload({ params: {}, query: {} }),
			requestBody: toAuditPayload({ version: EDITED_PROFILE_VERSION, fullName: "Demo Customer" }),
			responseBody: toAuditPayload({
				success: false,
				error: { code: OWN_PROFILE_ERROR_CODES.PROFILE_UPDATE_DURING_IMPERSONATION, message: PROFILE_UPDATE_DURING_IMPERSONATION_MESSAGE },
			}),
			systemOperations: [],
			impersonationSessionId,
		}),
	];

	const impersonatedEdit = rows.find(({ row }) => row.impersonationSessionId === impersonationSessionId);
	if (impersonatedEdit !== undefined) {
		await seedImpersonationSession(impersonationSessionId, actors.superAdminId, customer.id, impersonatedEdit.row.occurredAt);
	}

	for (const { id, row } of rows) {
		await prisma.auditLog.upsert({ where: { id }, create: { id, ...toAuditLogCreateInput(row) }, update: {} });
	}
	return { editedProfiles: 1, auditRows: rows.length };
}

/** The impersonation session the refused edit ran under, as `POST /auth/impersonate` + stop leave it. */
async function seedImpersonationSession(sessionId: string, superAdminId: string, targetUserId: string, requestAt: number): Promise<void> {
	const startedAt: number = requestAt - IMPERSONATION_MARGIN_MS;
	const endedAt: number = requestAt + IMPERSONATION_MARGIN_MS;
	const session = {
		impersonatorId: superAdminId,
		targetUserId,
		startedAt,
		expiresAt: startedAt + IMPERSONATION_TOKEN_TTL_SECONDS * MS_PER_SECOND,
		endedAt,
		endedBy: superAdminId,
		endReason: "STOPPED",
		ipAddress: null,
		userAgent: null,
		createdAt: startedAt,
		updatedAt: endedAt,
	} satisfies Omit<Prisma.ImpersonationSessionUncheckedCreateInput, "id">;
	await prisma.impersonationSession.upsert({ where: { id: sessionId }, create: { id: sessionId, ...session }, update: session });
	for (const [action, at] of [
		[ImpersonationAuditAction.START, startedAt],
		[ImpersonationAuditAction.STOP, endedAt],
	] satisfies [string, number][]) {
		const id: string = deterministicUuid(OWN_PROFILE_NAMESPACE, `impersonation-audit-${action}`);
		const row = { impersonatorId: superAdminId, targetUserId, sessionId, action, ipAddress: null, userAgent: null, createdAt: at };
		await prisma.impersonationAuditLog.upsert({ where: { id }, create: { id, ...row }, update: {} });
	}
}
