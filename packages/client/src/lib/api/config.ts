// ============================================
// lib/api/config.ts - Runtime configuration (the package's env module)
// ============================================
// This is the ONLY file in @workspace/client that reads `process.env` (the
// package lint config enforces it). The package is transpiled by each Next
// app (`transpilePackages`), so the literal `process.env.X` reads below are
// inlined per app at build time — which is why each variable must be written
// as a literal member access, never looked up dynamically.
//
// Values are validated with the shared zod building blocks and the module
// fails fast (at build / server start) with a named, value-free error rather
// than silently falling back to a hardcoded URL. See docs/technical/configuration/frontend.md.

import { API_VERSION_PREFIX, HttpUrlEnvSchema, NodeEnvSchema, parseEnvOrThrow } from "@workspace/shared";
import { z } from "zod";

const ClientPackageEnvSchema = z.strictObject({
	NEXT_PUBLIC_API_URL: HttpUrlEnvSchema,
	NODE_ENV: NodeEnvSchema,
});

const clientPackageEnv: Readonly<z.output<typeof ClientPackageEnvSchema>> = parseEnvOrThrow(
	ClientPackageEnvSchema,
	{
		NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
		NODE_ENV: process.env.NODE_ENV,
	} satisfies Record<keyof z.input<typeof ClientPackageEnvSchema>, string | undefined>,
	"@workspace/client (NEXT_PUBLIC_API_URL / NODE_ENV)",
);

/**
 * Base URL of the NestJS API, read from `NEXT_PUBLIC_API_URL`
 * (e.g. `NEXT_PUBLIC_API_URL=https://api.example.com` in `apps/<app>/.env`).
 */
export const API_BASE_URL: string = clientPackageEnv.NEXT_PUBLIC_API_URL;

/**
 * `NODE_ENV` the bundle was built for. Next.js inlines it in both server and
 * browser bundles, so it is safe to read from shared (isomorphic) code.
 */
export const RUNTIME_NODE_ENV: z.output<typeof NodeEnvSchema> = clientPackageEnv.NODE_ENV;

/**
 * Versioned path prefix for every API route. The single source of truth is
 * `API_VERSION_PREFIX` in `@workspace/shared` (contracts) — the SAME constant
 * the server controllers use to build their physical paths — so the client
 * transport and the server can never drift. Prepend this to a logical contract
 * path (`/auth/login`) when building an API URL.
 */
export const API_URL_PREFIX: string = API_VERSION_PREFIX;
