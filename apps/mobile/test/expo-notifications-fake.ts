// expo-notifications under Jest (jest.setup.ts mocks "expo-notifications" with this module): the
// notification permission, the device token and push taps are the OS's. A test decides the permission
// (`setNotificationPermission`), what the OS answers when asked (`answerPermissionRequestWith`) and
// taps a push (`tapPush`) or rotates the token (`rotatePushToken`). The permission is undecided and the token known unless a test says
// otherwise. Reset before every test.

import type { DevicePushToken, NotificationChannel, NotificationChannelInput, NotificationPermissionsStatus, NotificationResponse } from "expo-notifications";
import { PermissionStatus } from "expo";

type TapListener = (response: NotificationResponse) => void;

/** The token FCM hands this fake phone. */
export const FAKE_DEVICE_TOKEN = "fcm-token-for-tests";

let current: NotificationPermissionsStatus = statusOf("undetermined", true);
let answer: NotificationPermissionsStatus = statusOf("granted", true);
let requests = 0;
let tokenAvailable = true;
const tapListeners = new Set<TapListener>();
const tokenListeners = new Set<(token: DevicePushToken) => void>();
const channels = new Map<string, NotificationChannelInput>();

/** The OS's importance levels the app names (the real enum's values). */
export const AndroidImportance = { DEFAULT: 5, HIGH: 6 };

/** Android's notification channels: created (or updated) by id. */
export function setNotificationChannelAsync(id: string, channel: NotificationChannelInput): Promise<NotificationChannel | null> {
	channels.set(id, channel);
	return Promise.resolve(null);
}

/** The channels the app created, by id. */
export function createdChannels(): ReadonlyMap<string, NotificationChannelInput> {
	return channels;
}

function statusOf(status: "granted" | "denied" | "undetermined", canAskAgain: boolean): NotificationPermissionsStatus {
	const permission = status === "granted" ? PermissionStatus.GRANTED : status === "denied" ? PermissionStatus.DENIED : PermissionStatus.UNDETERMINED;
	return { status: permission, granted: status === "granted", canAskAgain, expires: "never" };
}

export function setNotificationPermission(status: "granted" | "denied" | "undetermined", canAskAgain = true): void {
	current = statusOf(status, canAskAgain);
}

/** What the OS answers the next time the app asks. */
export function answerPermissionRequestWith(status: "granted" | "denied"): void {
	answer = statusOf(status, status === "granted");
}

/** No token comes back (an emulator without Play services, a build without Firebase). */
export function withoutDeviceToken(): void {
	tokenAvailable = false;
}

export function permissionRequests(): number {
	return requests;
}

export function getPermissionsAsync(): Promise<NotificationPermissionsStatus> {
	return Promise.resolve(current);
}

export function requestPermissionsAsync(): Promise<NotificationPermissionsStatus> {
	requests += 1;
	current = answer;
	return Promise.resolve(current);
}

export function getDevicePushTokenAsync(): Promise<DevicePushToken> {
	return tokenAvailable ? Promise.resolve({ type: "android", data: FAKE_DEVICE_TOKEN }) : Promise.reject(new Error("No FCM token"));
}

export function addNotificationResponseReceivedListener(listener: TapListener): { readonly remove: () => void } {
	tapListeners.add(listener);
	return {
		remove: (): void => {
			tapListeners.delete(listener);
		},
	};
}

export function addPushTokenListener(listener: (token: DevicePushToken) => void): { readonly remove: () => void } {
	tokenListeners.add(listener);
	return {
		remove: (): void => {
			tokenListeners.delete(listener);
		},
	};
}

/** The OS rotates the phone's push token to `token`. */
export function rotatePushToken(token: string): void {
	for (const listener of tokenListeners) {
		listener({ type: "android", data: token });
	}
}

/** The person taps a push carrying `data`. */
export function tapPush(data: Readonly<Record<string, string>>): void {
	for (const listener of tapListeners) {
		listener({
			actionIdentifier: "expo.modules.notifications.actions.DEFAULT",
			notification: {
				date: 0,
				request: {
					identifier: "push-1",
					content: { title: null, subtitle: null, body: null, data: { ...data }, categoryIdentifier: null, sound: null, threadIdentifier: null },
					trigger: null,
				},
			},
		});
	}
}

export function reset(): void {
	current = statusOf("undetermined", true);
	answer = statusOf("granted", true);
	requests = 0;
	tokenAvailable = true;
	tapListeners.clear();
	tokenListeners.clear();
	channels.clear();
}
