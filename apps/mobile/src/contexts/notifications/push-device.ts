// This phone as a push device (ADR 070, direct FCM / APNs): the permission, asked only after the app's
// own primer explained it, and the device's native token, registered with the API
// (`PUT /notifications/push-devices`). A refused permission or a build without Firebase registers
// nothing; the inbox still works.

import type { PushPlatform, RegisterPushDeviceInput } from "@workspace/shared";
import { z } from "zod";

/** Where the phone's notification permission stands. */
export type PushPermission = "granted" | "undetermined" | "denied";

/** What registering this phone came to. */
export type PushRegistrationOutcome =
	| { readonly kind: "registered" }
	| { readonly kind: "denied" }
	/** No token: an emulator without Play services, a build without Firebase, or no network to Google/Apple. */
	| { readonly kind: "unavailable" };

/** What registration needs from the phone and the API (replaced in tests). */
export interface PushDevicePorts {
	readonly os: string;
	readonly permission: () => Promise<PushPermission>;
	readonly requestPermission: () => Promise<PushPermission>;
	readonly nativeToken: () => Promise<string>;
	readonly register: (input: RegisterPushDeviceInput) => Promise<void>;
	readonly deviceLabel: string | null;
	readonly appVersion: string | null;
}

const PushPlatformByOsSchema = z.enum(["ios", "android"]).transform((os): PushPlatform => (os === "ios" ? "IOS" : "ANDROID"));

/** The API's platform for this OS, or null on one that has no push (web). */
export function pushPlatformOf(os: string): PushPlatform | null {
	const parsed = PushPlatformByOsSchema.safeParse(os);
	return parsed.success ? parsed.data : null;
}

/** Ask (when still undecided) and register the token. Never throws: every ending is an outcome. */
export async function registerThisPhone(ports: PushDevicePorts): Promise<PushRegistrationOutcome> {
	const platform = pushPlatformOf(ports.os);
	if (platform === null) {
		return { kind: "unavailable" };
	}
	try {
		const current = await ports.permission();
		const permission = current === "undetermined" ? await ports.requestPermission() : current;
		if (permission !== "granted") {
			return { kind: "denied" };
		}
		const token = await ports.nativeToken();
		await ports.register({ token, platform, surface: "CUSTOMER", deviceLabel: ports.deviceLabel, appVersion: ports.appVersion });
		return { kind: "registered" };
	} catch {
		return { kind: "unavailable" };
	}
}

/**
 * Keep an already-allowed phone registered — on every start of the signed-in app and every return to it,
 * and when the OS rotates the token. It never asks: an undecided or refused permission registers nothing
 * (`skipped`), so only the primer's button ever brings up the OS prompt. Registering again is safe: the API
 * keeps one device per token and binds it to the current session (a sign-out ends the old binding).
 */
export async function refreshThisPhone(ports: PushDevicePorts): Promise<PushRegistrationOutcome | { readonly kind: "skipped" }> {
	const platform = pushPlatformOf(ports.os);
	if (platform === null) {
		return { kind: "unavailable" };
	}
	try {
		if ((await ports.permission()) !== "granted") {
			return { kind: "skipped" };
		}
		const token = await ports.nativeToken();
		await ports.register({ token, platform, surface: "CUSTOMER", deviceLabel: ports.deviceLabel, appVersion: ports.appVersion });
		return { kind: "registered" };
	} catch {
		return { kind: "unavailable" };
	}
}

const PushTapDataSchema = z.object({ deliveryId: z.uuid(), link: z.string().optional() });

/** What a tapped push carries: the delivery to report opened, and where to go. Null for anything else. */
export function pushTapOf(data: object | null | undefined): { readonly deliveryId: string; readonly link: string | null } | null {
	const parsed = PushTapDataSchema.safeParse(data);
	return parsed.success ? { deliveryId: parsed.data.deliveryId, link: parsed.data.link ?? null } : null;
}
