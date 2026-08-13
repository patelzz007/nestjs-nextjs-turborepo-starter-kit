import { z } from "zod";

import {
	TelescopeBodyCaptureSchema,
	TelescopeOptionsSchema,
	TelescopeStorageSchema,
	type TelescopeBodyCapture,
	type TelescopeOptions,
	type TelescopeStorage,
} from "@workspace/shared";

/** DI token for the resolved options (interfaces can't be injection tokens). */
export const TELESCOPE_OPTIONS = "TELESCOPE_OPTIONS";

/** DI token for the active store implementation. */
export const TELESCOPE_STORE = "TELESCOPE_STORE";

/**
 * Resolves the final Telescope options from the `register()` input + env.
 *
 * Order of precedence (docs/telescope.md §3 — "env wins at boot"):
 * 1. Explicit env vars (`TELESCOPE_*`) — highest priority.
 * 2. Values passed to `TelescopeModule.register({ ... })`.
 * 3. Schema defaults.
 *
 * Fail-closed by design: `NODE_ENV=production` disables Telescope unless
 * `TELESCOPE_ENABLED=true` is set explicitly (docs/telescope.md §6.4).
 */
export function resolveTelescopeOptions(provided: Partial<TelescopeOptions>): TelescopeOptions {
	const isProduction: boolean = process.env.NODE_ENV === "production";

	const envEnabled: string | undefined = process.env.TELESCOPE_ENABLED;
	const enabled: boolean = envEnabled !== undefined ? envEnabled === "true" : !isProduction;

	const envStorage: string | undefined = process.env.TELESCOPE_MODE;
	const storage: TelescopeStorage =
		envStorage !== undefined && TelescopeStorageSchema.safeParse(envStorage).success ? TelescopeStorageSchema.parse(envStorage) : (provided.storage ?? "memory");

	const envCaptureBody: string | undefined = process.env.TELESCOPE_BODY_CAPTURE;
	const captureBody: TelescopeBodyCapture =
		envCaptureBody !== undefined && TelescopeBodyCaptureSchema.safeParse(envCaptureBody).success
			? TelescopeBodyCaptureSchema.parse(envCaptureBody)
			: (provided.captureBody ?? "headers");

	const envMaxRequests: string | undefined = process.env.TELESCOPE_MAX_REQUESTS;
	const envSampleRate: string | undefined = process.env.TELESCOPE_SAMPLE_RATE;
	const envMaxBodyChars: string | undefined = process.env.TELESCOPE_BODY_LIMIT_CHARS;
	const envRetentionMinutes: string | undefined = process.env.TELESCOPE_RETENTION_MINUTES;
	const envAlertDurationMs: string | undefined = process.env.TELESCOPE_ALERT_DURATION_MS;
	const envAlertWindowMinutes: string | undefined = process.env.TELESCOPE_ALERT_WINDOW_MINUTES;

	// Feature 18 — webhook URL (empty = alerts stay in-app only).
	const envAlertWebhookUrl: string | undefined = process.env.TELESCOPE_ALERT_WEBHOOK_URL;

	// Feature 7 — named replay targets as JSON: `{"staging":"https://staging.example.com"}`.
	let replayTargets: Record<string, string> = {};
	const envReplayTargets: string | undefined = process.env.TELESCOPE_REPLAY_TARGETS;
	if (envReplayTargets !== undefined && envReplayTargets.length > 0) {
		try {
			const parsed = z.record(z.string(), z.string()).safeParse(JSON.parse(envReplayTargets));
			if (parsed.success) {
				replayTargets = parsed.data;
			}
		} catch {
			// Invalid JSON — fall back to the empty map (local only).
		}
	}

	// Effective sample rate: explicit env beats the dev/prod default.
	const sampleRate: number = envSampleRate !== undefined ? Number(envSampleRate) : isProduction ? (provided.sampling?.prod ?? 0.01) : (provided.sampling?.dev ?? 1);

	// Sanity clamp — a typo like "200%" must not disable capture silently.
	const clampedSampleRate: number = Number.isFinite(sampleRate) ? Math.min(1, Math.max(0, sampleRate)) : isProduction ? 0.01 : 1;

	const maxRequests: number = envMaxRequests !== undefined ? Number(envMaxRequests) : (provided.maxRequests ?? 10000);
	const maxBodyChars: number = envMaxBodyChars !== undefined ? Number(envMaxBodyChars) : (provided.maxBodyChars ?? 2000);
	const retentionMinutes: number = envRetentionMinutes !== undefined ? Number(envRetentionMinutes) : (provided.retentionMinutes ?? 1440);

	// Comma-separated path lists from env (e.g. `TELESCOPE_CAPTURE_PATHS=/api,/auth`).
	const envCapturePaths: string[] = (process.env.TELESCOPE_CAPTURE_PATHS ?? "")
		.split(",")
		.map((path: string): string => path.trim())
		.filter((path: string): boolean => path.length > 0);
	const envRedactPaths: string[] = (process.env.TELESCOPE_REDACT_PATHS ?? "")
		.split(",")
		.map((path: string): string => path.trim())
		.filter((path: string): boolean => path.length > 0);

	const alertDurationMs: number = envAlertDurationMs !== undefined ? Number(envAlertDurationMs) : (provided.alertDurationMs ?? 2000);
	const alertWindowMinutes: number = envAlertWindowMinutes !== undefined ? Number(envAlertWindowMinutes) : (provided.alertWindowMinutes ?? 5);

	return TelescopeOptionsSchema.parse({
		enabled,
		storage,
		maxRequests: Number.isFinite(maxRequests) && maxRequests > 0 ? Math.floor(maxRequests) : 10000,
		maxBodyChars: Number.isFinite(maxBodyChars) && maxBodyChars > 0 ? Math.floor(maxBodyChars) : 2000,
		retentionMinutes: Number.isFinite(retentionMinutes) && retentionMinutes > 0 ? Math.floor(retentionMinutes) : 1440,
		capturePaths: envCapturePaths.length > 0 ? envCapturePaths : provided.capturePaths,
		redactPaths: envRedactPaths.length > 0 ? envRedactPaths : (provided.redactPaths ?? []),
		token: process.env.TELESCOPE_TOKEN !== undefined && process.env.TELESCOPE_TOKEN.length > 0 ? process.env.TELESCOPE_TOKEN : provided.token,
		captureBody,
		captureHeaders: provided.captureHeaders,
		ignorePaths: provided.ignorePaths,
		sampling: { dev: clampedSampleRate, prod: clampedSampleRate },
		alertWebhookUrl: envAlertWebhookUrl !== undefined && envAlertWebhookUrl.length > 0 ? envAlertWebhookUrl : provided.alertWebhookUrl,
		alertDurationMs: Number.isFinite(alertDurationMs) && alertDurationMs > 0 ? Math.floor(alertDurationMs) : 2000,
		alertWindowMinutes: Number.isFinite(alertWindowMinutes) && alertWindowMinutes > 0 ? Math.floor(alertWindowMinutes) : 5,
		replayTargets: { ...replayTargets, ...(provided.replayTargets ?? {}) },
	});
}
