import {
	deliveryOfLink,
	foregroundPictureOf,
	handleForegroundPush,
	type ForegroundPicture,
	type PictureNotificationNativeModule,
	type PushContent,
} from "../foreground-picture";

const DELIVERY_ID = "0193f2c4-0000-7000-8000-0000000000f1";
const IMAGE_URL = "https://cdn.example.com/cake-1280.webp";
const PICTURE_PUSH: PushContent = { title: "Fresh", body: "A first look.", data: { deliveryId: DELIVERY_ID, imageUrl: IMAGE_URL, category: "ACCOUNT" } };
const PLAIN_PUSH: PushContent = { title: "New sign-in", body: "From Chrome.", data: { deliveryId: DELIVERY_ID, category: "SECURITY" } };
const linkOf = (deliveryId: string): string => `starter://settings/notifications?delivery=${deliveryId}`;

function nativeModule(failure: Error | null = null): { readonly module: PictureNotificationNativeModule; readonly shown: ForegroundPicture[] } {
	const shown: ForegroundPicture[] = [];
	return {
		shown,
		module: {
			show: (notification: ForegroundPicture): Promise<void> => {
				shown.push(notification);
				return failure === null ? Promise.resolve() : Promise.reject(failure);
			},
		},
	};
}

describe("foregroundPictureOf", () => {
	it("posts a picture push on its kind's channel, opening the inbox for that delivery", () => {
		expect(foregroundPictureOf(PICTURE_PUSH, linkOf)).toEqual({
			id: DELIVERY_ID,
			title: "Fresh",
			body: "A first look.",
			imageUrl: IMAGE_URL,
			channelId: "notifications-account",
			openUrl: linkOf(DELIVERY_ID),
		});
	});

	it("leaves a push with no picture, or no title, alone", () => {
		expect(foregroundPictureOf(PLAIN_PUSH, linkOf)).toBeNull();
		expect(foregroundPictureOf({ ...PICTURE_PUSH, title: null }, linkOf)).toBeNull();
	});
});

describe("handleForegroundPush", () => {
	it("hands a picture push to our module and hides Expo's own copy, so it never shows twice", async () => {
		const { module, shown } = nativeModule();

		const behavior = await handleForegroundPush(PICTURE_PUSH, module, linkOf);

		expect(shown).toHaveLength(1);
		expect(behavior).toMatchObject({ shouldShowBanner: false, shouldShowList: false });
	});

	it("shows every other push as before", async () => {
		const { module, shown } = nativeModule();

		const behavior = await handleForegroundPush(PLAIN_PUSH, module, linkOf);

		expect(shown).toHaveLength(0);
		expect(behavior).toMatchObject({ shouldShowBanner: true, shouldShowList: true });
	});

	it("falls back to Expo's notification when ours fails, so the push is never lost", async () => {
		const { module } = nativeModule(new Error("no context"));

		await expect(handleForegroundPush(PICTURE_PUSH, module, linkOf)).resolves.toMatchObject({ shouldShowBanner: true });
	});
});

describe("deliveryOfLink", () => {
	it("reads the delivery of a tapped picture notification, and nothing from any other link", () => {
		expect(deliveryOfLink({ delivery: DELIVERY_ID })).toBe(DELIVERY_ID);
		expect(deliveryOfLink({ page: "2" })).toBeNull();
		expect(deliveryOfLink(null)).toBeNull();
	});
});
