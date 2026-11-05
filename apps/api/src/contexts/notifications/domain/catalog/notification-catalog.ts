// ============================================
// notifications/domain/catalog/notification-catalog.ts — every notification type the platform sends
// ============================================

import { PLATFORM_DISPLAY_REGION } from "@workspace/shared";

import type { NotificationType } from "./notification-type";
import { OPERATIONS_ALERT_NOTIFICATION } from "./types/operations.types";
import { BROADCAST_MESSAGE_NOTIFICATION, TEST_NOTIFICATION } from "./types/platform.types";
import {
	LEGACY_REWARD_NOTICE,
	REFERRER_CREDITED_NOTIFICATION,
	REWARD_APPROVED_NOTIFICATION,
	REWARD_AUTO_PUBLISHED_NOTIFICATION,
	REWARD_REJECTED_NOTIFICATION,
	SIGNUP_REFERRAL_SUCCESS_NOTIFICATION,
} from "./types/rewards.types";
import { NEW_SIGN_IN_NOTIFICATION, PASSWORD_CHANGED_NOTIFICATION, PHONE_CODE_NOTIFICATION } from "./types/security.types";
import { WEBHOOK_ENDPOINT_AUTO_DISABLED_NOTIFICATION } from "./types/webhooks.types";

/** The time zone a person without their own is read in. */
export const DEFAULT_NOTIFICATION_TIME_ZONE: string = PLATFORM_DISPLAY_REGION.timeZone;

export const NOTIFICATION_CATALOG: readonly NotificationType[] = [
	NEW_SIGN_IN_NOTIFICATION,
	PASSWORD_CHANGED_NOTIFICATION,
	PHONE_CODE_NOTIFICATION,
	REFERRER_CREDITED_NOTIFICATION,
	REWARD_APPROVED_NOTIFICATION,
	REWARD_REJECTED_NOTIFICATION,
	REWARD_AUTO_PUBLISHED_NOTIFICATION,
	SIGNUP_REFERRAL_SUCCESS_NOTIFICATION,
	LEGACY_REWARD_NOTICE,
	BROADCAST_MESSAGE_NOTIFICATION,
	TEST_NOTIFICATION,
	OPERATIONS_ALERT_NOTIFICATION,
	WEBHOOK_ENDPOINT_AUTO_DISABLED_NOTIFICATION,
];

export class UnknownNotificationTypeError extends Error {
	public constructor(typeKey: string) {
		super(`No notification type is declared with the key "${typeKey}"`);
		this.name = "UnknownNotificationTypeError";
	}
}

export function findNotificationType(typeKey: string): NotificationType | null {
	return NOTIFICATION_CATALOG.find((type: NotificationType): boolean => type.key === typeKey) ?? null;
}

export function notificationType(typeKey: string): NotificationType {
	const type = findNotificationType(typeKey);
	if (type === null) {
		throw new UnknownNotificationTypeError(typeKey);
	}
	return type;
}
