import { epochMs, InAppNotificationResponseSchema, type InAppNotificationResponse } from "@workspace/shared";
import MegaphoneIcon from "lucide-react-native/icons/megaphone";
import ShieldAlertIcon from "lucide-react-native/icons/shield-alert";
import SirenIcon from "lucide-react-native/icons/siren";

import { categoryKindOf, externalLinkOf, feedSectionsOf, isUnread, NEW_FOR_MS, noticeKindOf, noticeSenderOf } from "../feed-model";

/** 31 Oct 2026, 09:00 UTC. */
const NOW = Date.UTC(2026, 9, 31, 9, 0, 0);
const HOUR_MS = 3_600_000;
const TWO = 2;

function notice(id: string, createdAt: number, overrides: Partial<InAppNotificationResponse> = {}): InAppNotificationResponse {
	return InAppNotificationResponseSchema.parse({
		id,
		typeKey: "notifications.test",
		category: "ACCOUNT",
		surface: "CUSTOMER",
		title: "Test notification",
		body: "Sent from the catalog.",
		richBody: null,
		link: null,
		icon: null,
		senderName: null,
		senderLogoUrl: null,
		groupCount: 1,
		broadcastId: null,
		readAt: null,
		archivedAt: null,
		createdAt,
		updatedAt: createdAt,
		isDeleted: false,
		deletedAt: null,
		...overrides,
	});
}

const RECENT = notice("0193f2c4-0000-7000-8000-0000000000a1", NOW - TWO * HOUR_MS);
const OLD = notice("0193f2c4-0000-7000-8000-0000000000a2", NOW - NEW_FOR_MS - HOUR_MS);

describe("feedSectionsOf", () => {
	it("puts the last day under New and the rest under Earlier, keeping the order", () => {
		expect(feedSectionsOf([RECENT, OLD], NOW)).toEqual([
			{ key: "new", notifications: [RECENT] },
			{ key: "earlier", notifications: [OLD] },
		]);
	});

	it("leaves out an empty section", () => {
		expect(feedSectionsOf([OLD], NOW).map((section) => section.key)).toEqual(["earlier"]);
		expect(feedSectionsOf([], NOW)).toEqual([]);
	});

	it("counts a notice exactly a day old as earlier", () => {
		const dayOld = notice("0193f2c4-0000-7000-8000-0000000000a3", NOW - NEW_FOR_MS);
		expect(feedSectionsOf([dayOld], NOW).map((section) => section.key)).toEqual(["earlier"]);
	});
});

describe("the notice's look", () => {
	it("gives each kind its glyph and colour", () => {
		expect(noticeKindOf(notice(RECENT.id, NOW, { category: "SECURITY" }))).toEqual({ icon: ShieldAlertIcon, tone: "red" });
		expect(noticeKindOf(notice(RECENT.id, NOW, { category: "MARKETING" }))).toEqual({ icon: MegaphoneIcon, tone: "orange" });
		expect(noticeKindOf(notice(RECENT.id, NOW, { category: "OPERATIONS" }))).toEqual({ icon: SirenIcon, tone: "yellow" });
	});

	it("gives a kind of message the same look as its notices", () => {
		expect(categoryKindOf("SECURITY")).toEqual({ icon: ShieldAlertIcon, tone: "red" });
		expect(categoryKindOf("OPERATIONS")).toEqual({ icon: SirenIcon, tone: "yellow" });
	});

	it("leads with the sender named on it, or nobody when the app sent it", () => {
		expect(noticeSenderOf(notice(RECENT.id, NOW, { senderName: "Kopi & Co", senderLogoUrl: "https://cdn.example.com/kopi.png" }))).toEqual({
			name: "Kopi & Co",
			imageUrl: "https://cdn.example.com/kopi.png",
		});
		expect(noticeSenderOf(RECENT)).toBeNull();
	});

	it("is unread until read", () => {
		expect(isUnread(RECENT)).toBe(true);
		expect(isUnread(notice(RECENT.id, NOW, { readAt: epochMs(NOW) }))).toBe(false);
	});
});

describe("externalLinkOf", () => {
	it("follows an https page, and nothing else", () => {
		expect(externalLinkOf(notice(RECENT.id, NOW, { link: "https://example.com/offers?week=44" }))).toBe("https://example.com/offers?week=44");
		expect(externalLinkOf(notice(RECENT.id, NOW, { link: "/rewards/123" }))).toBeNull();
		expect(externalLinkOf(notice(RECENT.id, NOW, { link: "http://example.com" }))).toBeNull();
		expect(externalLinkOf(notice(RECENT.id, NOW, { link: "javascript:alert(1)" }))).toBeNull();
		expect(externalLinkOf(notice(RECENT.id, NOW, { link: "https:///no-host" }))).toBeNull();
		expect(externalLinkOf(RECENT)).toBeNull();
	});
});
