import type { Prisma } from "@prisma/client";
import type { PersonalDataExporter, PersonalDataSectionContent, PersonalDataSubject } from "../../../../platform/application/personal-data/personal-data-export.registry";
import { epochOrNullJson, readAsPerson, type PersonTransactions } from "../../../../platform/infrastructure/personal-data/read-as-person";
import { JsonValueSchema, type JsonValue } from "@workspace/shared";

/**
 * The account section of "Download my data" (ADR 077): the profile, settings, every device signed in and the
 * passkeys (ADR 080). Facts only: never the password hash, the 2FA secret, a session token or a key.
 */
export class IdentityPersonalDataExporter implements PersonalDataExporter {
	public readonly section = "account";
	public readonly description = "Your profile, your settings, your passkeys, and every device that is or was signed in to your account";

	public constructor(private readonly transactions: PersonTransactions) {}

	public export({ actor, userId }: PersonalDataSubject): Promise<PersonalDataSectionContent> {
		return readAsPerson(this.transactions, actor, async (tx: Prisma.TransactionClient): Promise<PersonalDataSectionContent> => {
			const profile = await tx.user.findFirst({
				where: { id: userId, isDeleted: false },
				select: {
					id: true,
					email: true,
					fullName: true,
					phone: true,
					phoneVerifiedAt: true,
					emailVerifiedAt: true,
					locale: true,
					twoFactorEnabled: true,
					lastLoginAt: true,
					createdAt: true,
				},
			});
			const preferences = await tx.userPreference.findMany({
				where: { userId, isDeleted: false },
				select: { key: true, value: true, updatedAt: true },
				orderBy: { key: "asc" },
			});
			const devices = await tx.refreshToken.findMany({
				where: { userId },
				orderBy: { createdAt: "asc" },
				select: {
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
					isDeleted: true,
				},
			});
			const passkeys = await tx.webAuthnCredential.findMany({
				where: { userId },
				orderBy: { createdAt: "asc" },
				select: { name: true, deviceType: true, backedUp: true, transports: true, createdAt: true, lastUsedAt: true, isDeleted: true },
			});
			const data: JsonValue = {
				profile:
					profile === null
						? null
						: {
								...profile,
								phoneVerifiedAt: epochOrNullJson(profile.phoneVerifiedAt),
								emailVerifiedAt: epochOrNullJson(profile.emailVerifiedAt),
								lastLoginAt: epochOrNullJson(profile.lastLoginAt),
								createdAt: Number(profile.createdAt),
							},
				settings: preferences.map((preference) => ({ key: preference.key, value: JsonValueSchema.parse(preference.value), updatedAt: Number(preference.updatedAt) })),
				signedInDevices: devices.map(({ isDeleted, createdAt, lastActiveAt, expiresAt, ...device }) => ({
					...device,
					signedInAt: Number(createdAt),
					lastActiveAt: Number(lastActiveAt),
					expiresAt: Number(expiresAt),
					signedOut: isDeleted,
				})),
				passkeys: passkeys.map(({ isDeleted, createdAt, lastUsedAt, ...passkey }) => ({
					...passkey,
					addedAt: Number(createdAt),
					lastUsedAt: epochOrNullJson(lastUsedAt),
					removed: isDeleted,
				})),
			};
			return { records: (profile === null ? 0 : 1) + preferences.length + devices.length + passkeys.length, data };
		});
	}
}
