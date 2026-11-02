import type { JsonObject, NotificationSurface } from "@workspace/shared";
import { z } from "zod";

import { defineNotificationType, type TypedNotificationType } from "../notification-type";

/** Security notices show in every app the person uses. */
export const ALL_SURFACES: readonly NotificationSurface[] = ["CUSTOMER", "MERCHANT", "ADMIN"];

const NewSignInPayloadSchema = z.object({ device: z.string().min(1).max(160), location: z.string().max(160).nullable(), signedInAt: z.number().int().nonnegative() }).strict();
type NewSignInPayload = z.output<typeof NewSignInPayloadSchema>;

/** A sign-in from a device the account has not used before. */
export const NEW_SIGN_IN_NOTIFICATION: TypedNotificationType<NewSignInPayload> = defineNotificationType({
	key: "security.new-sign-in",
	description: "Someone signed in from a new device",
	category: "SECURITY",
	surfaces: ALL_SURFACES,
	channels: ["IN_APP", "EMAIL", "PUSH"],
	urgency: "immediate",
	sensitive: false,
	allowsContactRecipient: false,
	digestible: false,
	grouping: null,
	payloadSchema: NewSignInPayloadSchema,
	toJson: (payload: NewSignInPayload): JsonObject => ({ ...payload }),
	samplePayload: { device: "Chrome on macOS", location: "Kuala Lumpur, Malaysia", signedInAt: 1_793_318_400_000 },
	renderers: {
		en: {
			inApp: (payload) => ({
				title: "New sign-in",
				body: `${payload.device}${payload.location === null ? "" : ` · ${payload.location}`}`,
				link: "/settings/security",
				icon: "shield",
			}),
			email: (payload, context) => ({
				subject: `New sign-in to your ${context.appName} account`,
				eyebrow: "Security notice",
				heading: "New sign-in",
				paragraphs: [
					`Your account was just signed in to from ${payload.device}${payload.location === null ? "" : ` near ${payload.location}`}.`,
					"If this was you, there is nothing to do. If it wasn't, change your password and sign out other devices now.",
				],
				action: { label: "Review your devices", url: `${context.webUrl}/settings/security` },
			}),
			push: (payload) => ({ title: "New sign-in", body: `Signed in from ${payload.device}. Not you? Secure your account.`, link: "/settings/security" }),
		},
	},
});

const PasswordChangedPayloadSchema = z.object({ changedAt: z.number().int().nonnegative() }).strict();
type PasswordChangedPayload = z.output<typeof PasswordChangedPayloadSchema>;

/** The account's password changed. */
export const PASSWORD_CHANGED_NOTIFICATION: TypedNotificationType<PasswordChangedPayload> = defineNotificationType({
	key: "security.password-changed",
	description: "The account password was changed",
	category: "SECURITY",
	surfaces: ALL_SURFACES,
	channels: ["IN_APP", "EMAIL", "PUSH"],
	urgency: "immediate",
	sensitive: false,
	allowsContactRecipient: false,
	digestible: false,
	grouping: null,
	payloadSchema: PasswordChangedPayloadSchema,
	toJson: (payload: PasswordChangedPayload): JsonObject => ({ ...payload }),
	samplePayload: { changedAt: 1_793_318_400_000 },
	renderers: {
		en: {
			inApp: () => ({ title: "Password changed", body: "Your password was changed. Not you? Reset it now.", link: "/settings/security", icon: "key" }),
			email: (_payload, context) => ({
				subject: "Your password was changed",
				eyebrow: "Security notice",
				heading: "Password updated",
				paragraphs: [`The password for your ${context.appName} account was just changed.`, "If you did not make this change, reset your password right away."],
				action: { label: "Reset password", url: `${context.webUrl}/forgot-password` },
			}),
			push: () => ({ title: "Password changed", body: "Your password was changed. Not you? Reset it now.", link: "/settings/security" }),
		},
	},
});

const PhoneCodePayloadSchema = z.object({ code: z.string().regex(/^\d{6}$/) }).strict();
type PhoneCodePayload = z.output<typeof PhoneCodePayloadSchema>;

/** A one-time code by SMS: sensitive (never kept, never in the inbox), may go to a number with no account. */
export const PHONE_CODE_NOTIFICATION: TypedNotificationType<PhoneCodePayload> = defineNotificationType({
	key: "security.phone-code",
	description: "A one-time code to verify a phone number",
	category: "SECURITY",
	surfaces: ALL_SURFACES,
	channels: ["SMS"],
	urgency: "immediate",
	sensitive: true,
	allowsContactRecipient: true,
	digestible: false,
	grouping: null,
	payloadSchema: PhoneCodePayloadSchema,
	toJson: (payload: PhoneCodePayload): JsonObject => ({ ...payload }),
	samplePayload: { code: "482913" },
	renderers: {
		en: {
			sms: (payload, context) => ({ text: `${context.appName}: your code is ${payload.code}. It expires in 10 minutes. Never share it.` }),
		},
	},
});
