import type { Prisma } from "@prisma/client";

import type { PersonalDataExporter, PersonalDataSectionContent, PersonalDataSubject } from "../../../../platform/application/personal-data/personal-data-export.registry";
import { readAsPerson, rowsToJson, type PersonTransactions } from "../../../../platform/infrastructure/personal-data/read-as-person";

/** The notifications section of "Download my data" (ADR 077). Push device tokens are never exported (ciphertext or hash). */
export class NotificationsPersonalDataExporter implements PersonalDataExporter {
	public readonly section = "notifications";
	public readonly description = "Your notification choices and quiet hours, your inbox, the phones registered for push, and every marketing consent you gave or withdrew";

	public constructor(private readonly transactions: PersonTransactions) {}

	public export({ actor, userId }: PersonalDataSubject): Promise<PersonalDataSectionContent> {
		return readAsPerson(this.transactions, actor, async (tx: Prisma.TransactionClient): Promise<PersonalDataSectionContent> => {
			const preferences = await tx.notificationPreference.findMany({ where: { userId, isDeleted: false }, orderBy: { createdAt: "asc" } });
			const schedules = await tx.notificationSchedule.findMany({ where: { userId, isDeleted: false } });
			const inbox = await tx.inAppNotification.findMany({ where: { userId, isDeleted: false }, orderBy: { createdAt: "asc" } });
			const pushDevices = await tx.pushDevice.findMany({ where: { userId }, omit: { tokenCiphertext: true, tokenHash: true }, orderBy: { createdAt: "asc" } });
			const marketingConsents = await tx.marketingConsent.findMany({ where: { userId }, orderBy: { occurredAt: "asc" } });
			return {
				records: preferences.length + schedules.length + inbox.length + pushDevices.length + marketingConsents.length,
				data: {
					preferences: rowsToJson(preferences),
					quietHours: rowsToJson(schedules),
					inbox: rowsToJson(inbox),
					pushDevices: rowsToJson(pushDevices),
					marketingConsents: rowsToJson(marketingConsents),
				},
			};
		});
	}
}
