// ============================================
// sessions/device/session-device.ts — what a device session records about the device
// ============================================
// docs/technical/mobile/mobile-app.md §8.2. Every client-reported value
// (User-Agent, the mobile device headers, the app version) is DISPLAY-ONLY:
// it is bounded and validated with the shared zod schemas before storage, and
// never influences authorization, rate limits or risk decisions. An invalid
// value is dropped (stored as NULL) rather than refused — a strange phone name
// must never block a sign-in.

import {
	APP_VERSION_HEADER,
	AppVersionSchema,
	DEVICE_MODEL_HEADER,
	DEVICE_NAME_HEADER,
	isBrowserClientType,
	SESSION_BROWSER_NAME_MAX_LENGTH,
	SESSION_BROWSER_VERSION_MAX_LENGTH,
	SESSION_OS_NAME_MAX_LENGTH,
	SESSION_OS_VERSION_MAX_LENGTH,
	SessionDeviceModelHeaderSchema,
	SessionDeviceModelSchema,
	SessionDeviceNameHeaderSchema,
	sessionDisplayTextSchema,
	type AuthClientType,
	type DeviceType,
} from "@workspace/shared";
import type { FastifyRequest } from "fastify";
import type { z } from "zod";

import { parseUserAgent, type ParsedUserAgent } from "../../../common/http/user-agent";
import { extractClientInfo } from "../../../common/utils/client-info";
import { readFirstHeader } from "../../../common/utils/http-headers";
import { resolveRequestClientType } from "../../auth/utils/client-type";

/** The device details stored on a session row (every column of §8.2 the device itself determines). */
export interface SessionDeviceDetails {
	readonly clientType: AuthClientType;
	readonly browserName: string | null;
	readonly browserVersion: string | null;
	readonly osName: string | null;
	readonly osVersion: string | null;
	readonly deviceType: DeviceType;
	readonly deviceModel: string | null;
	readonly deviceName: string | null;
	readonly appVersion: string | null;
}

/** The request that signs a device in (or refreshes it): its device details and the server-observed IP. */
export interface SessionDeviceContext {
	readonly device: SessionDeviceDetails;
	/** Fastify's `request.ip` (trusted-proxy aware), or `null` when unknown. */
	readonly ipAddress: string | null;
	/** The raw User-Agent (bounded) — used by the login flows (new-device recognition, the verification email), never stored on the session. */
	readonly userAgent: string | null;
}

/** What a device claims about itself, before validation. */
export interface SessionDeviceClaims {
	readonly clientType: AuthClientType;
	readonly userAgent: string | undefined;
	/** `X-Device-Model` (client type `mobile` only). */
	readonly deviceModelHeader: string | undefined;
	/** `X-Device-Name` (client type `mobile` only). */
	readonly deviceNameHeader: string | undefined;
	/** `X-App-Version` (client type `mobile` only). */
	readonly appVersionHeader: string | undefined;
}

const BrowserNameSchema = sessionDisplayTextSchema(SESSION_BROWSER_NAME_MAX_LENGTH);
const BrowserVersionSchema = sessionDisplayTextSchema(SESSION_BROWSER_VERSION_MAX_LENGTH);
const OsNameSchema = sessionDisplayTextSchema(SESSION_OS_NAME_MAX_LENGTH);
const OsVersionSchema = sessionDisplayTextSchema(SESSION_OS_VERSION_MAX_LENGTH);

/** The validated value, or `null` when it is absent or invalid (display-only data is dropped, never refused). */
function validOrNull(schema: z.ZodType<string, string>, value: string | null | undefined): string | null {
	if (value === null || value === undefined) {
		return null;
	}
	const parsed = schema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

/**
 * The device details of a session from what the device claims: browser, OS
 * and device class from the User-Agent (`parseUserAgent`); for client type
 * `mobile` also the model and name headers and the app version. Browser
 * client types never get a device name or app version, whatever they send.
 */
export function describeSessionDevice(claims: SessionDeviceClaims): SessionDeviceDetails {
	const parsed: ParsedUserAgent = parseUserAgent(claims.userAgent);
	const isMobile = !isBrowserClientType(claims.clientType);
	const reportedModel: string | null = isMobile ? validOrNull(SessionDeviceModelHeaderSchema, claims.deviceModelHeader) : null;

	return {
		clientType: claims.clientType,
		browserName: validOrNull(BrowserNameSchema, parsed.browserName),
		browserVersion: validOrNull(BrowserVersionSchema, parsed.browserVersion),
		osName: validOrNull(OsNameSchema, parsed.osName),
		osVersion: validOrNull(OsVersionSchema, parsed.osVersion),
		deviceType: parsed.deviceType,
		deviceModel: reportedModel ?? validOrNull(SessionDeviceModelSchema, parsed.deviceModel),
		deviceName: isMobile ? validOrNull(SessionDeviceNameHeaderSchema, claims.deviceNameHeader) : null,
		appVersion: isMobile ? validOrNull(AppVersionSchema, claims.appVersionHeader) : null,
	};
}

/** The device context of a request (sign-in, login completion, refresh). */
export function readSessionDeviceContext(request: Pick<FastifyRequest, "headers" | "query" | "ip">): SessionDeviceContext {
	const { deviceInfo, ipAddress } = extractClientInfo(request);
	const device: SessionDeviceDetails = describeSessionDevice({
		clientType: resolveRequestClientType(request),
		userAgent: deviceInfo,
		deviceModelHeader: readFirstHeader(request.headers[DEVICE_MODEL_HEADER.toLowerCase()]),
		deviceNameHeader: readFirstHeader(request.headers[DEVICE_NAME_HEADER.toLowerCase()]),
		appVersionHeader: readFirstHeader(request.headers[APP_VERSION_HEADER.toLowerCase()]),
	});
	return { device, ipAddress: ipAddress ?? null, userAgent: deviceInfo ?? null };
}
