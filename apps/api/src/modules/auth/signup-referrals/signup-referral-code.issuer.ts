import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";

import { SIGNUP_REFERRAL_CODE_TTL_MS } from "@workspace/shared";

import { generateSignupReferralCode } from "./signup-referral-code.generator";
import { SignupReferralCodeAllocationError } from "./signup-referral.errors";

/**
 * Candidates tried before giving up. 31^8 (~8.5 × 10^11) values make even one
 * collision rare for any realistic user count; the bound only stops a broken
 * generator from looping forever.
 */
export const SIGNUP_REFERRAL_CODE_MAX_ATTEMPTS = 8;

/** A code row as issuance wrote it. */
export interface IssuedSignupReferralCode {
	readonly id: string;
	readonly code: string;
	readonly createdAt: number;
	readonly expiresAt: number;
}

/**
 * Insert one new referral code for `userId` on the caller's transaction
 * (ADR 035, "Who receives a code"). `createdAt` is `now` and `expiresAt` is
 * exactly `now + SIGNUP_REFERRAL_CODE_TTL_MS`, so the window is measured from
 * the insert.
 *
 * A collision on the unique `code` must not abort the caller's transaction (a
 * failed INSERT inside a Postgres transaction poisons every later statement),
 * so each candidate is written with `ON CONFLICT DO NOTHING`
 * (`skipDuplicates`) and a zero count means "try another value". A retired
 * value is never reused: the unique index covers every row ever inserted.
 */
export async function issueSignupReferralCode(
	db: Prisma.TransactionClient,
	userId: string,
	now: number,
	generate: () => string = generateSignupReferralCode,
): Promise<IssuedSignupReferralCode> {
	const createdAt = BigInt(now);
	const expiresAt = now + SIGNUP_REFERRAL_CODE_TTL_MS;
	for (let attempt = 1; attempt <= SIGNUP_REFERRAL_CODE_MAX_ATTEMPTS; attempt += 1) {
		const id = randomUUID();
		const code = generate();
		const { count } = await db.signupReferralCode.createMany({
			data: [{ id, userId, code, createdAt, updatedAt: createdAt, expiresAt: BigInt(expiresAt) }],
			skipDuplicates: true,
		});
		if (count === 1) {
			return { id, code, createdAt: now, expiresAt };
		}
	}
	throw new SignupReferralCodeAllocationError(SIGNUP_REFERRAL_CODE_MAX_ATTEMPTS);
}
