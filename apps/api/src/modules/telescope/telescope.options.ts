import {
	TelescopeBodyCaptureSchema,
	TelescopeOptionsSchema,
	TelescopeStorageSchema,
	type TelescopeBodyCapture,
	type TelescopeOptions,
	type TelescopeStorage,
} from "@workspace/shared";

/** DI token for the resolved options (interfaces can't be injection tokens). */
export const TELESCOPE_OPTIONS: string = "TELESCOPE_OPTIONS";

/** DI token for the active store implementation. */
export const TELESCOPE_STORE: string = "TELESCOPE_STORE";

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
		envStorage !== undefined && TelescopeStorageSchema.safeParse(envStorage).success
			? TelescopeStorageSchema.parse(envStorage)
			: (provided.storage ?? "memory");

	const envCaptureBody: string | undefined = process.env.TELESCOPE_BODY_CAPTURE;
	const captureBody: TelescopeBodyCapture =
		envCaptureBody !== undefined && TelescopeBodyCaptureSchema.safeParse(envCaptureBody).success
			? TelescopeBodyCaptureSchema.parse(envCaptureBody)
			: (provided.captureBody ?? "headers");

	const envMaxRequests: string | undefined = process.env.TELESCOPE_MAX_REQUESTS;
	const envSampleRate: string | undefined = process.env.TELESCOPE_SAMPLE_RATE;

	// Effective sample rate: explicit env beats the dev/prod default.
	const sampleRate: number = envSampleRate !== undefined
		? Number(envSampleRate)
		: isProduction
			? (provided.sampling?.prod ?? 0.01)
			: (provided.sampling?.dev ?? 1);

	// Sanity clamp — a typo like "200%" must not disable capture silently.
	const clampedSampleRate: number = Number.isFinite(sampleRate)
		? Math.min(1, Math.max(0, sampleRate))
		: isProduction
			? 0.01
			: 1;

	const maxRequests: number = envMaxRequests !== undefined ? Number(envMaxRequests) : (provided.maxRequests ?? 1000);

	return TelescopeOptionsSchema.parse({
		enabled,
		storage,
		maxRequests: Number.isFinite(maxRequests) && maxRequests > 0 ? Math.floor(maxRequests) : 1000,
		captureBody,
		captureHeaders: provided.captureHeaders,
		ignorePaths: provided.ignorePaths,
		sampling: { dev: clampedSampleRate, prod: clampedSampleRate },
	});
}

/**
 * `storage: "postgres"` is the documented opt-in persistence upgrade
 * (docs/telescope.md §6.2). It is not implemented yet — fall back to the
 * memory store with a loud warning instead of booting with a broken store.
 */
export function warnUnsupportedStorage(storage: TelescopeStorage): void {
	if (storage === "postgres") {
		console.warn(
			"[Telescope] storage: \"postgres\" is not implemented yet (docs/telescope.md §6.2) — falling back to the in-memory store.",
		);
	}
}
