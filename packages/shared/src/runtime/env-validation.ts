// Environment validation schemas for each workspace
import { z } from "zod";

// Shared environment variables (used by multiple workspaces)
export const sharedEnvSchema = z.object({
	// JWT secrets - must be at least 32 characters
	JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
	JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
	EMAIL_VERIFICATION_SECRET: z.string().min(32, "EMAIL_VERIFICATION_SECRET must be at least 32 characters"),

	// Database URL
	DATABASE_URL: z.url("DATABASE_URL must be a valid URL"),

	// Port
	PORT: z.string().regex(/^\d+$/, "PORT must be a number").transform(Number),

	// CORS origins
	CORS_ORIGINS: z.string().nonempty("CORS_ORIGINS is required"),

	// App metadata
	APP_NAME: z.string().nonempty("APP_NAME is required"),
	APP_URL: z.url("APP_URL must be a valid URL"),
});

// Web-specific environment variables
export const webEnvSchema = z.object({
	NEXT_PUBLIC_API_URL: z.url("NEXT_PUBLIC_API_URL must be a valid URL"),
	NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS: z.union([z.literal("true"), z.literal("false"), z.undefined()]).optional(),
});

// Admin-specific environment variables
export const adminEnvSchema = z.object({
	NEXT_PUBLIC_API_URL: z.url("NEXT_PUBLIC_API_URL must be a valid URL"),
	NEXT_PUBLIC_WEB_URL: z.url("NEXT_PUBLIC_WEB_URL must be a valid URL"),
	NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS: z.union([z.literal("true"), z.literal("false"), z.undefined()]).optional(),
	NEXT_PUBLIC_SESSION_POLL_MS: z.string().regex(/^\d*$/, "NEXT_PUBLIC_SESSION_POLL_MS must be a number").optional(),
});

// Combined schema for API (includes shared vars + API-only vars)
export const apiEnvSchema = sharedEnvSchema.extend({
	// NestJS Observe — auto-instrumented observability (observe.nestjs.com)
	// Optional: app works without these, telemetry is simply dropped on 401.
	OBSERVE_APP_KEY: z.string().optional(),
	OBSERVE_APP_SECRET: z.string().optional(),
	OBSERVE_SERVICE_ID: z.string().optional(),
});

// Validation result type
export interface ValidationResult<T> {
	success: boolean;
	data?: T;
	error?: string;
}

export type EnvRecord = Record<string, string | undefined>;

// Validate environment variables against a schema
export function validateEnv<T>(schema: z.ZodType<T>, env: EnvRecord): ValidationResult<T> {
	try {
		const parsed = schema.parse(env);
		return { success: true, data: parsed };
	} catch (error) {
		if (error instanceof z.ZodError) {
			const issues = error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n");
			return { success: false, error: `Environment validation failed:\n${issues}` };
		}
		const message = error instanceof Error ? error.message : String(error);
		return { success: false, error: `Environment validation failed: ${message}` };
	}
}

// Convenience functions for each workspace
export function validateWebEnv(env: EnvRecord): ValidationResult<z.infer<typeof webEnvSchema>> {
	return validateEnv(webEnvSchema, env);
}

export function validateAdminEnv(env: EnvRecord): ValidationResult<z.infer<typeof adminEnvSchema>> {
	return validateEnv(adminEnvSchema, env);
}

export function validateApiEnv(env: EnvRecord): ValidationResult<z.infer<typeof apiEnvSchema>> {
	return validateEnv(apiEnvSchema, env);
}
