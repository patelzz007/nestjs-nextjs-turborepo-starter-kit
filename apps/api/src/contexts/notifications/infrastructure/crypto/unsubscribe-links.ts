// ============================================
// notifications/infrastructure/crypto/unsubscribe-links.ts — signed one-click unsubscribe links (RFC 8058, ADR 070)
// ============================================
// `<web>/unsubscribe?token=<payload>.<hmac>` (the page) and `<api>/notifications/unsubscribe/one-click?token=…`
// (RFC 8058) carry the same token: the payload names who (a user, or a contact
// point's address hash), which category and which tenant; the HMAC (SHA-256, a key derived for this
// purpose only) makes it unforgeable. It never expires: an unsubscribe link must keep working.

import { createHmac, timingSafeEqual } from "node:crypto";

import { NotificationCategorySchema, type NotificationCategory } from "@workspace/shared";
import { z } from "zod";

import type { UnsubscribeTarget, UnsubscribeVerifier } from "../../application/services/notification-account.service";
import type { UnsubscribeLinkFactory } from "../../application/services/notification-fan-out";
import { destinationHash } from "../../domain/policies/mask-destination";
import type { EmailUnsubscribeLinks } from "../../domain/templates/base/base-email-template";

const PURPOSE = "notifications.unsubscribe.v1";

export const UnsubscribeTokenPayloadSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("user"), userId: z.uuid(), category: NotificationCategorySchema, tenantId: z.uuid().nullable() }).strict(),
	z.object({ kind: z.literal("contact-point"), destinationHash: z.string().regex(/^[0-9a-f]{64}$/) }).strict(),
]);
export type UnsubscribeTokenPayload = z.output<typeof UnsubscribeTokenPayloadSchema>;

export class InvalidUnsubscribeTokenError extends Error {
	public constructor() {
		super("This unsubscribe link is not valid");
		this.name = "InvalidUnsubscribeTokenError";
	}
}

export class SignedUnsubscribeLinks implements UnsubscribeLinkFactory, UnsubscribeVerifier {
	private readonly key: Buffer;

	public constructor(
		secret: string,
		/** The web page a person opens: `https://app…/unsubscribe`. */
		private readonly pageUrl: string,
		/** The RFC 8058 endpoint: `https://api…/api/v1/notifications/unsubscribe/one-click`. */
		private readonly oneClickUrl: string,
	) {
		this.key = createHmac("sha256", secret).update(PURPOSE).digest();
	}

	public forUser(userId: string, category: NotificationCategory, tenantId: string | null): EmailUnsubscribeLinks {
		return this.link({ kind: "user", userId, category, tenantId });
	}

	public forContactPoint(address: string): EmailUnsubscribeLinks {
		return this.link({ kind: "contact-point", destinationHash: destinationHash(address) });
	}

	public verify(token: string): UnsubscribeTarget {
		const [payload = "", signature = ""] = token.split(".");
		const expected = this.sign(payload);
		const given = Buffer.from(signature, "base64url");
		if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
			throw new InvalidUnsubscribeTokenError();
		}
		try {
			return UnsubscribeTokenPayloadSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
		} catch {
			throw new InvalidUnsubscribeTokenError();
		}
	}

	private link(payload: UnsubscribeTokenPayload): EmailUnsubscribeLinks {
		const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
		const query = new URLSearchParams({ token: `${encoded}.${this.sign(encoded).toString("base64url")}` }).toString();
		return { pageUrl: `${this.pageUrl}?${query}`, oneClickUrl: `${this.oneClickUrl}?${query}` };
	}

	private sign(encoded: string): Buffer {
		return createHmac("sha256", this.key).update(encoded).digest();
	}
}
