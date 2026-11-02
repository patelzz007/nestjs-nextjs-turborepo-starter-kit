// ============================================
// notifications/domain/catalog/notification-type.ts — one kind of message the platform sends (ADR 070)
// ============================================
// A type is declared once: its category, surfaces, channels, flags and one renderer per channel and
// locale. Producers pass data (the payload), never copy: the renderers own every word, so translating
// later touches no producer. `defineNotificationType` turns the typed declaration into a handle the
// fan-out and workers can render from stored JSON without knowing the payload's type.

import type { JsonObject, NotificationCategory, NotificationChannel, NotificationSurface } from "@workspace/shared";
import type { z } from "zod";

/** The only locale shipped today; every type renders it, and a missing locale falls back to it. */
export const DEFAULT_NOTIFICATION_LOCALE = "en";

export interface NotificationRenderContext {
	readonly appName: string;
	/** The web, merchant and admin app origins (links in notifications point into them). */
	readonly webUrl: string;
	readonly merchantUrl: string;
	readonly adminUrl: string;
	/** How many notifications are folded into this one (1 when not grouped). */
	readonly groupCount: number;
}

export interface InAppRendering {
	readonly title: string;
	readonly body: string;
	/** An app path (`/rewards/…`) or an https link; null when opening it leads nowhere. */
	readonly link: string | null;
	readonly icon: string | null;
}

export interface EmailRendering {
	readonly subject: string;
	readonly eyebrow: string;
	readonly heading: string;
	readonly paragraphs: readonly string[];
	readonly action: { readonly label: string; readonly url: string } | null;
}

export interface PushRendering {
	readonly title: string;
	readonly body: string;
	readonly link: string | null;
}

export interface SmsRendering {
	readonly text: string;
}

export interface NotificationRenderers<TPayload> {
	readonly inApp?: (payload: TPayload, context: NotificationRenderContext) => InAppRendering;
	readonly email?: (payload: TPayload, context: NotificationRenderContext) => EmailRendering;
	readonly push?: (payload: TPayload, context: NotificationRenderContext) => PushRendering;
	readonly sms?: (payload: TPayload, context: NotificationRenderContext) => SmsRendering;
}

export interface NotificationGrouping<TPayload> {
	/** Notifications of one type for one person with the same key fold into one. */
	readonly key: (payload: TPayload) => string;
	readonly windowMs: number;
}

export interface NotificationTypeDeclaration<TPayload> {
	/** `context.event`, stable: stored on every row. */
	readonly key: string;
	readonly description: string;
	readonly category: NotificationCategory;
	/** A broadcast type takes its category from the broadcast (marketing, product or account). */
	readonly categoryOverridable?: boolean;
	readonly surfaces: readonly NotificationSurface[];
	readonly channels: readonly NotificationChannel[];
	/** `immediate` skips quiet hours, grouping and digests (security, one-time codes). */
	readonly urgency: "immediate" | "normal";
	/** Carries a secret: its content is never kept, never in the inbox, never on a lock screen. */
	readonly sensitive: boolean;
	/** May go to a bare email address or phone number (an invite, a pre-signup code). */
	readonly allowsContactRecipient: boolean;
	/** Its email may be held for the daily or weekly digest. */
	readonly digestible: boolean;
	readonly grouping: NotificationGrouping<TPayload> | null;
	/** The channel tried once when a channel cannot deliver at all (no device, unverified phone, suppressed). */
	readonly fallback?: Partial<Record<NotificationChannel, NotificationChannel>>;
	readonly payloadSchema: z.ZodType<TPayload, JsonObject>;
	/** Renderers per locale; `en` is required. */
	readonly renderers: { readonly en: NotificationRenderers<TPayload> } & Readonly<Partial<Record<string, NotificationRenderers<TPayload>>>>;
	/** Serializes a payload to the JSON stored on the notification row. */
	readonly toJson: (payload: TPayload) => JsonObject;
	/** A representative payload for the admin catalog preview and "Send test". */
	readonly samplePayload: TPayload;
}

/** A declared type, usable without its payload type: everything is rendered from the stored JSON. */
export interface NotificationType {
	readonly key: string;
	readonly description: string;
	readonly category: NotificationCategory;
	readonly categoryOverridable: boolean;
	readonly surfaces: readonly NotificationSurface[];
	readonly channels: readonly NotificationChannel[];
	readonly urgency: "immediate" | "normal";
	readonly sensitive: boolean;
	readonly allowsContactRecipient: boolean;
	readonly digestible: boolean;
	readonly groupingWindowMs: number | null;
	fallbackFor(channel: NotificationChannel): NotificationChannel | null;
	/** Checks stored JSON against the payload schema; `null` when it no longer parses. */
	isValidPayload(payload: JsonObject): boolean;
	groupKey(payload: JsonObject): string | null;
	renderInApp(payload: JsonObject, locale: string, context: NotificationRenderContext): InAppRendering | null;
	renderEmail(payload: JsonObject, locale: string, context: NotificationRenderContext): EmailRendering | null;
	renderPush(payload: JsonObject, locale: string, context: NotificationRenderContext): PushRendering | null;
	renderSms(payload: JsonObject, locale: string, context: NotificationRenderContext): SmsRendering | null;
	samplePayloadJson(): JsonObject;
}

/** A declared type together with its typed declaration (producers use the typed half). */
export interface TypedNotificationType<TPayload> extends NotificationType {
	readonly declaration: NotificationTypeDeclaration<TPayload>;
}

export class NotificationPayloadError extends Error {
	public constructor(typeKey: string, detail: string) {
		super(`Notification payload for "${typeKey}" is invalid: ${detail}`);
		this.name = "NotificationPayloadError";
	}
}

function renderersFor<TPayload>(declaration: NotificationTypeDeclaration<TPayload>, locale: string): NotificationRenderers<TPayload> {
	return declaration.renderers[locale] ?? declaration.renderers.en;
}

export function defineNotificationType<TPayload>(declaration: NotificationTypeDeclaration<TPayload>): TypedNotificationType<TPayload> {
	const parse = (payload: JsonObject): TPayload => {
		const parsed = declaration.payloadSchema.safeParse(payload);
		if (!parsed.success) {
			throw new NotificationPayloadError(declaration.key, parsed.error.message);
		}
		return parsed.data;
	};
	const channelSet = new Set<NotificationChannel>(declaration.channels);
	return {
		declaration,
		key: declaration.key,
		description: declaration.description,
		category: declaration.category,
		categoryOverridable: declaration.categoryOverridable ?? false,
		surfaces: declaration.surfaces,
		channels: declaration.channels,
		urgency: declaration.urgency,
		sensitive: declaration.sensitive,
		allowsContactRecipient: declaration.allowsContactRecipient,
		digestible: declaration.digestible,
		groupingWindowMs: declaration.grouping?.windowMs ?? null,
		fallbackFor: (channel: NotificationChannel): NotificationChannel | null => declaration.fallback?.[channel] ?? null,
		isValidPayload: (payload: JsonObject): boolean => declaration.payloadSchema.safeParse(payload).success,
		groupKey: (payload: JsonObject): string | null => (declaration.grouping === null ? null : declaration.grouping.key(parse(payload))),
		renderInApp: (payload, locale, context): InAppRendering | null =>
			channelSet.has("IN_APP") ? (renderersFor(declaration, locale).inApp?.(parse(payload), context) ?? null) : null,
		renderEmail: (payload, locale, context): EmailRendering | null =>
			channelSet.has("EMAIL") ? (renderersFor(declaration, locale).email?.(parse(payload), context) ?? null) : null,
		renderPush: (payload, locale, context): PushRendering | null =>
			channelSet.has("PUSH") ? (renderersFor(declaration, locale).push?.(parse(payload), context) ?? null) : null,
		renderSms: (payload, locale, context): SmsRendering | null => (channelSet.has("SMS") ? (renderersFor(declaration, locale).sms?.(parse(payload), context) ?? null) : null),
		samplePayloadJson: (): JsonObject => declaration.toJson(declaration.samplePayload),
	};
}
