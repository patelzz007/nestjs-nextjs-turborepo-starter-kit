// This phone's push ports (push-device.ts) on the real OS: expo-notifications for the permission and the
// native FCM / APNs token, the API for the registration. Shared by the primer's button and the silent
// refresh, so both register exactly the same way.

import type { RegisterPushDeviceInput } from "@workspace/shared";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { z } from "zod";

import type { PushDevicePorts, PushPermission } from "./push-device";

/** A native FCM / APNs token: a plain string (the web's subscription object never reaches here). */
const DeviceTokenSchema = z.object({ data: z.string().min(1) });

export function permissionOf(status: Notifications.NotificationPermissionsStatus): PushPermission {
	if (status.granted) {
		return "granted";
	}
	return status.canAskAgain ? "undetermined" : "denied";
}

/** The device token in a token event or answer, or null when it is not a native token. */
export function nativeTokenOf(token: Notifications.DevicePushToken): string | null {
	return DeviceTokenSchema.safeParse(token).data?.data ?? null;
}

/**
 * The ports for this phone. `token` is the one the OS just handed over (a rotation); without it the
 * current token is read.
 */
export function phonePushPorts(register: (input: RegisterPushDeviceInput) => Promise<void>, token: string | null = null): PushDevicePorts {
	return {
		os: Platform.OS,
		permission: async (): Promise<PushPermission> => permissionOf(await Notifications.getPermissionsAsync()),
		requestPermission: async (): Promise<PushPermission> => permissionOf(await Notifications.requestPermissionsAsync()),
		nativeToken: async (): Promise<string> => token ?? DeviceTokenSchema.parse(await Notifications.getDevicePushTokenAsync()).data,
		register,
		deviceLabel: Device.modelName,
		appVersion: Constants.expoConfig?.version ?? null,
	};
}
