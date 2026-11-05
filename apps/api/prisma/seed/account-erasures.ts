// The account-erasure seed (ADR 077): one request in each state, and the "Deleted user" tombstone a completed
// erasure leaves behind, so the screens, the job and seed coverage have real rows (every column has a value).
import type { Prisma } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { DAY_MS } from "@workspace/shared";

import { prisma } from "./client";
import { deterministicUuid } from "./deterministic-uuid";
import { EXTRA_SEED_USER_EMAILS } from "./extra-users";

const NAMESPACE = "account-erasures";
const SEED_BCRYPT_ROUNDS = 10;
const GRACE_DAYS = 30;

export interface AccountErasureSeedResult {
	readonly requests: number;
}

/** A completed erasure (support, with a reason) and its tombstone, a cancelled one, and a pending one. */
export async function seedAccountErasures(now: number): Promise<AccountErasureSeedResult> {
	const superAdmin = await prisma.user.findFirstOrThrow({ where: { email: "superadmin@example.com", isDeleted: false }, select: { id: true } });
	const [cancelledEmail, pendingEmail] = EXTRA_SEED_USER_EMAILS;
	if (cancelledEmail === undefined || pendingEmail === undefined) {
		throw new Error("the extra seed users are missing");
	}
	const cancelledUser = await prisma.user.findFirstOrThrow({ where: { email: cancelledEmail, isDeleted: false }, select: { id: true } });
	const pendingUser = await prisma.user.findFirstOrThrow({ where: { email: pendingEmail, isDeleted: false }, select: { id: true } });

	const tombstoneId = deterministicUuid(NAMESPACE, "user:tombstone");
	const erasedAt = BigInt(now - 3 * DAY_MS);
	const tombstone = {
		email: `erased+${tombstoneId}@erased.invalid`,
		fullName: "Deleted user",
		passwordHash: await bcrypt.hash(deterministicUuid(NAMESPACE, "password:tombstone"), SEED_BCRYPT_ROUNDS),
		isActive: false,
		erasedAt,
	};
	await prisma.user.upsert({ where: { id: tombstoneId }, create: { id: tombstoneId, ...tombstone }, update: tombstone });

	const requests: readonly (Prisma.AccountErasureUncheckedCreateInput & { readonly id: string })[] = [
		{
			id: deterministicUuid(NAMESPACE, "erasure:completed"),
			userId: tombstoneId,
			status: "COMPLETED",
			requestedByUserId: superAdmin.id,
			reason: "Asked by email on 1 October; identity confirmed by phone (ticket 4410)",
			requestedAt: BigInt(now - (GRACE_DAYS + 3) * DAY_MS),
			scheduledFor: BigInt(now - 3 * DAY_MS),
			cancelledAt: null,
			cancelledByUserId: null,
			completedAt: erasedAt,
		},
		{
			id: deterministicUuid(NAMESPACE, "erasure:cancelled"),
			userId: cancelledUser.id,
			status: "CANCELLED",
			requestedByUserId: cancelledUser.id,
			reason: null,
			requestedAt: BigInt(now - 10 * DAY_MS),
			scheduledFor: BigInt(now + (GRACE_DAYS - 10) * DAY_MS),
			cancelledAt: BigInt(now - 8 * DAY_MS),
			cancelledByUserId: cancelledUser.id,
			completedAt: null,
		},
		{
			id: deterministicUuid(NAMESPACE, "erasure:pending"),
			userId: pendingUser.id,
			status: "PENDING",
			requestedByUserId: pendingUser.id,
			reason: null,
			requestedAt: BigInt(now - 2 * DAY_MS),
			scheduledFor: BigInt(now + (GRACE_DAYS - 2) * DAY_MS),
			cancelledAt: null,
			cancelledByUserId: null,
			completedAt: null,
		},
	];
	for (const { id, ...data } of requests) {
		await prisma.accountErasure.upsert({ where: { id }, create: { id, ...data }, update: data });
	}
	return { requests: requests.length };
}
