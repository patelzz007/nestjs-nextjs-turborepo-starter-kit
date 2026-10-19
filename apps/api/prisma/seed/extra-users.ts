import type { Role, User } from "@prisma/client";
import * as bcrypt from "bcrypt";

import { prisma } from "./client";
import { SEED_DEVICE_PROFILES, SEED_MOBILE_PROFILES, SEED_SESSION_LOCATIONS, seedSessionRow } from "./device-sessions";
import { daysAgo, daysFromNow, rand, randInt, randomIpv4 } from "./helpers";

/** Display names of the additional demo users; user N gets `user-NN@example.com`. */
const NAMES: readonly string[] = [
	"Liam Smith",
	"Olivia Johnson",
	"Noah Davis",
	"Emma Brown",
	"Oliver Wilson",
	"Ava Taylor",
	"William Anderson",
	"Sophie Thomas",
	"James Jackson",
	"Mia White",
	"Benjamin Harris",
	"Charlotte Martin",
	"Lucas Thompson",
	"Amelia Garcia",
	"Henry Martinez",
	"Harper Robinson",
	"Alexander Clark",
	"Evelyn Rodriguez",
	"Daniel Lewis",
	"Abigail Lee",
];

/** Email of the `index`-th additional demo user. */
function extraUserEmail(index: number): string {
	return `user-${String(index + 1).padStart(2, "0")}@example.com`;
}

/** Every account {@link generateAdditionalSeedData} owns — the seed's cleanup is scoped to these. */
export const EXTRA_SEED_USER_EMAILS: readonly string[] = NAMES.map((_name, index) => extraUserEmail(index));

/** Additional seed data: 20 extra customer accounts (3 inactive), each with a web and a mobile device session. */
export async function generateAdditionalSeedData(roles: Role[], userRole: Role): Promise<User[]> {
	const hash = (pw: string): Promise<string> => bcrypt.hash(pw, 10);
	const defaultPassword = await hash("User@123");

	const createdUsers: User[] = [];

	for (const [i, name] of NAMES.entries()) {
		const email = extraUserEmail(i);
		const isActive = i < 17; // 3 inactive users

		const fullName = name;
		const u = await prisma.user.upsert({
			where: { email },
			update: { fullName, isActive },
			create: {
				email,
				passwordHash: defaultPassword,
				fullName,
				isActive,
				isSuperAdmin: false,
			},
		});
		createdUsers.push(u);

		// Assign User role
		await prisma.userRole.upsert({
			where: { userId_roleId: { userId: u.id, roleId: userRole.id } },
			update: {},
			create: { userId: u.id, roleId: userRole.id },
		});

		// Two device sessions per user: the web app on a desktop and the mobile app.
		const desktopIp: string = randomIpv4();
		const phoneIp: string = randomIpv4();
		await prisma.refreshToken.createMany({
			data: [
				seedSessionRow({
					userId: u.id,
					tokenHash: `rt_${u.id}_d_${String(Date.now())}`,
					profile: SEED_DEVICE_PROFILES.webChromeMac,
					signInMethod: "PASSWORD_NEW_DEVICE_CODE",
					ipAddress: desktopIp,
					lastIpAddress: desktopIp,
					location: rand([...SEED_SESSION_LOCATIONS, null]),
					createdAt: daysAgo(randInt(1, 6)),
					lastActiveAt: daysAgo(randInt(0, 1)),
					expiresAt: daysFromNow(7),
				}),
				seedSessionRow({
					userId: u.id,
					tokenHash: `rt_${u.id}_m_${String(Date.now() + 1)}`,
					profile: rand(SEED_MOBILE_PROFILES),
					signInMethod: "PASSWORD",
					ipAddress: phoneIp,
					lastIpAddress: randomIpv4(),
					location: rand(SEED_SESSION_LOCATIONS),
					createdAt: daysAgo(randInt(2, 6)),
					lastActiveAt: daysAgo(randInt(0, 1)),
					expiresAt: daysFromNow(7),
				}),
			],
		});
	}

	return createdUsers;
}
