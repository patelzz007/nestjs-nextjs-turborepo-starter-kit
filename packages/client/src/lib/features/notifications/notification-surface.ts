import type { AuthClientType, NotificationSurface } from "@workspace/shared";

/**
 * Which inbox each app shows (ADR 070): a person has one inbox per surface, so the customer app never
 * shows a merchant's reward-review notices and the admin console never shows a customer's.
 */
export const NOTIFICATION_SURFACE_OF_CLIENT: Readonly<Record<AuthClientType, NotificationSurface>> = {
	web: "CUSTOMER",
	mobile: "CUSTOMER",
	merchant: "MERCHANT",
	admin: "ADMIN",
};
