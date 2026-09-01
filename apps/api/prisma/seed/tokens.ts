import type { User } from "@prisma/client";
import * as crypto from "crypto";
import * as bcrypt from "bcrypt";

import { prisma } from "./client";
import { daysAgo, daysFromNow, rand, randInt } from "./helpers";

export async function createRefreshTokens(users: User[]): Promise<void> {
	const activeUsers = users.filter((u) => u.isActive);
	for (const u of activeUsers) {
		await prisma.refreshToken.createMany({
			data: [
				{
					userId: u.id,
					token: `rt_${u.id}_desktop_${Date.now()}`,
					deviceInfo: rand(["Chrome on Windows", "Safari on macOS", "Firefox on Linux"]),
					ipAddress: `${randInt(1, 254)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`,
					expiresAt: daysFromNow(7),
				},
				{
					userId: u.id,
					token: `rt_${u.id}_mobile_${Date.now() + 1}`,
					deviceInfo: rand(["Chrome on Android", "Safari on iOS", "Samsung Internet"]),
					ipAddress: `${randInt(1, 254)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`,
					expiresAt: daysFromNow(30),
				},
			],
		});
	}
}

export async function createPasswordResetTokens(users: User[]): Promise<void> {
	const hash = (s: string): Promise<string> => bcrypt.hash(s, 10);
	const activeUsers = users.filter((u) => u.isActive);

	const rows: Array<{
		userId: string;
		token: string;
		expiresAt: number;
	}> = [];

	// Create 3 pending tokens for different users
	const pendingRequests: Array<{ email: string }> = [{ email: "user@example.com" }, { email: "alice.johnson@example.com" }, { email: "henry.moore@example.com" }];

	for (const { email } of pendingRequests) {
		const user = activeUsers.find((u) => u.email === email);
		if (!user) continue;
		const rawToken = crypto.randomBytes(32).toString("hex");
		const tokenHash = await hash(rawToken);
		rows.push({
			userId: user.id,
			token: tokenHash,
			expiresAt: daysFromNow(1), // valid for 1 day
		});
	}

	// Create 1 expired token (used/past expiry)
	const expiredUser = activeUsers.find((u) => u.email === "carol.white@example.com");
	if (expiredUser) {
		const rawToken = crypto.randomBytes(32).toString("hex");
		const tokenHash = await hash(rawToken);
		rows.push({
			userId: expiredUser.id,
			token: tokenHash,
			expiresAt: daysAgo(2), // expired 2 days ago
		});
	}

	if (rows.length > 0) {
		await prisma.passwordResetToken.createMany({
			data: rows,
			skipDuplicates: true,
		});
	}
}
