import { systemOperationEraser, type ErasureSystemTransactions } from "../../../../platform/infrastructure/personal-data/erasure-helpers";
import type { PersonalDataEraser } from "../../../../platform/application/personal-data/personal-data-erasure.registry";

/** Notifications' part of erasure (ADR 077): the inbox, choices, quiet hours and registered phones. Consents stay (masked). */
export function notificationsEraser(transactions: ErasureSystemTransactions): PersonalDataEraser {
	return systemOperationEraser("notifications", transactions, (tx, { userId }) =>
		Promise.all([
			tx.inAppNotification.deleteMany({ where: { userId } }),
			tx.notificationPreference.deleteMany({ where: { userId } }),
			tx.notificationSchedule.deleteMany({ where: { userId } }),
			tx.pushDevice.deleteMany({ where: { userId } }),
		]),
	);
}
