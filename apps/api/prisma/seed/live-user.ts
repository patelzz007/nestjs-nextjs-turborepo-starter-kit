import type { Prisma, User } from "@prisma/client";

import { prisma } from "./client";

/**
 * Creates or updates the **live** account with this email. Email is unique among live accounts only
 * (`@@unique([email], where: { isDeleted: false })`), and PostgreSQL can't `ON CONFLICT` on a partial unique
 * index, so Prisma's `upsert` keyed by email would fail: the seed finds the live row first. Seeds run as
 * one process, so nothing races between the read and the write; the partial unique still refuses a second
 * live account if anything ever did.
 */
export async function upsertLiveUserByEmail(email: string, update: Prisma.UserUpdateInput, create: Prisma.UserCreateInput): Promise<User> {
	const live = await prisma.user.findFirst({ where: { email, isDeleted: false }, select: { id: true } });
	return live === null ? prisma.user.create({ data: create }) : prisma.user.update({ where: { id: live.id }, data: update });
}
