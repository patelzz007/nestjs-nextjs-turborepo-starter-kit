// ============================================
// device-headers.ts - the device details the mobile app reports
// ============================================
// `X-Device-Model` ("iPhone 15 Pro") and `X-Device-Name` ("Alex’s iPhone"),
// from expo-device, percent-encoded UTF-8 (`encodeSessionDeviceHeaderValue`) so
// any name survives an HTTP header. The API stores them on the device session
// for DISPLAY ONLY and drops an invalid value (docs/technical/mobile/mobile-app.md
// §8.10, §20.1). A value that already fails the shared display schema is not
// sent at all.

import {
	CLIENT_PLATFORM_HEADER,
	ClientPlatformSchema,
	DEVICE_MODEL_HEADER,
	DEVICE_NAME_HEADER,
	encodeSessionDeviceHeaderValue,
	SessionDeviceModelSchema,
	SessionDeviceNameSchema,
} from "@workspace/shared";
import * as Device from "expo-device";
import { Platform } from "react-native";
import type { z } from "zod";

/** What expo-device reports (each may be unknown), and the operating system React Native runs on. */
export interface DeviceDetails {
	readonly modelName: string | null;
	readonly deviceName: string | null;
	/** `Platform.OS`: `ios` or `android` is sent as `X-Client-Platform`, which feature flag rules can match (ADR 087). */
	readonly platform: string;
}

function platformHeader(platform: string): Record<string, string> {
	const parsed = ClientPlatformSchema.safeParse(platform);
	return parsed.success ? { [CLIENT_PLATFORM_HEADER]: parsed.data } : {};
}

function encodedHeader(name: string, value: string | null, schema: z.ZodType<string>): Record<string, string> {
	if (value === null) {
		return {};
	}
	const parsed = schema.safeParse(value);
	return parsed.success ? { [name]: encodeSessionDeviceHeaderValue(parsed.data) } : {};
}

/** The device headers for `details`; a detail that is unknown or invalid is left out. */
export function buildDeviceHeaders(details: DeviceDetails): Record<string, string> {
	return {
		...encodedHeader(DEVICE_MODEL_HEADER, details.modelName, SessionDeviceModelSchema),
		...encodedHeader(DEVICE_NAME_HEADER, details.deviceName, SessionDeviceNameSchema),
		...platformHeader(details.platform),
	};
}

/** This device's details. */
export function readDeviceDetails(): DeviceDetails {
	return { modelName: Device.modelName, deviceName: Device.deviceName, platform: Platform.OS };
}
