// config/api-config/api-env.rules.ts — Cross-field rules: checks that span several variables, reported by name and never by value.
// Part of the API environment contract; `../api-config.schema.ts` is its public entry.

import { NodeEnvSchema, GITHUB_REPOSITORIES_MAX } from "@workspace/shared";
import { listKafkaSecurityEnvIssues } from "@workspace/messaging/kafka";
import { z } from "zod";

import type { StorageProviderSetting } from "../api-env.fields";
import { configuredPrivateContainer, configuredPublicContainer, resolveStorageProvider } from "./api-config.derivations";
import type { ApiEnv } from "./api-env.input";

// ── Cross-field rules ──────────────────────────────────────────────────────

/** Signing secrets that must all differ, so one leak cannot forge another token type. */
export type DistinctSecretKey = "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET" | "EMAIL_VERIFICATION_SECRET" | "TWO_FACTOR_PENDING_SECRET";

export function requireDistinctSecrets(env: ApiEnv, context: z.RefinementCtx<ApiEnv>): void {
	const secrets: readonly (readonly [DistinctSecretKey, string])[] = [
		["JWT_ACCESS_SECRET", env.JWT_ACCESS_SECRET],
		["JWT_REFRESH_SECRET", env.JWT_REFRESH_SECRET],
		["EMAIL_VERIFICATION_SECRET", env.EMAIL_VERIFICATION_SECRET],
		["TWO_FACTOR_PENDING_SECRET", env.TWO_FACTOR_PENDING_SECRET],
	];
	const seen = new Map<string, DistinctSecretKey>();
	for (const [key, value] of secrets) {
		const previous: DistinctSecretKey | undefined = seen.get(value);
		if (previous !== undefined) {
			context.addIssue({ code: "custom", path: [key], message: `must differ from ${previous}` });
			continue;
		}
		seen.set(value, key);
	}
}

/** Host names that only ever mean "this machine". */
export const LOOPBACK_HOSTNAMES: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * Whether a URL points at the local machine (`localhost`, `*.localhost`,
 * 127.0.0.1, ::1). A production build whose `APP_URL` is loopback is someone
 * running the production bundle on their own machine, not a deployment.
 */
/** Live updates need both halves, GitHub only delivers to https, and they ride on the linked tokens. */
export function checkGithubWebhookRules(env: ApiEnv, context: z.RefinementCtx<ApiEnv>): void {
	if ((env.GITHUB_WEBHOOK_URL === undefined) !== (env.GITHUB_WEBHOOK_SECRET === undefined)) {
		const missing: keyof ApiEnv = env.GITHUB_WEBHOOK_URL === undefined ? "GITHUB_WEBHOOK_URL" : "GITHUB_WEBHOOK_SECRET";
		context.addIssue({
			code: "custom",
			path: [missing],
			message: "must be set together with its live-updates counterpart (GITHUB_WEBHOOK_URL + GITHUB_WEBHOOK_SECRET), or leave both unset",
		});
	}
	if (env.GITHUB_WEBHOOK_URL !== undefined && !env.GITHUB_WEBHOOK_URL.startsWith("https://")) {
		context.addIssue({ code: "custom", path: ["GITHUB_WEBHOOK_URL"], message: "must be https — GitHub delivers webhooks to public https addresses only" });
	}
	if (env.GITHUB_WEBHOOK_URL !== undefined && env.GITHUB_CREDENTIAL_ENCRYPTION_KEYS === undefined) {
		context.addIssue({
			code: "custom",
			path: ["GITHUB_CREDENTIAL_ENCRYPTION_KEYS"],
			message: "is required when GITHUB_WEBHOOK_URL is set (webhooks are registered with the admins' linked tokens)",
		});
	}
}

export function isLoopbackUrl(url: string): boolean {
	const hostname = new URL(url).hostname.toLowerCase();
	return LOOPBACK_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost");
}

/**
 * A production build serving real users. A production build whose `APP_URL`
 * is loopback is someone running the bundle on their own machine.
 */
export function isDeployedProduction(env: ApiEnv): boolean {
	return env.NODE_ENV === NodeEnvSchema.enum.production && !isLoopbackUrl(env.APP_URL);
}

export function checkStorageRules(env: ApiEnv, context: z.RefinementCtx<ApiEnv>): void {
	const provider: StorageProviderSetting = resolveStorageProvider(env);
	if (provider !== "local" && configuredPrivateContainer(env) === undefined) {
		context.addIssue({
			code: "custom",
			path: ["STORAGE_PRIVATE_CONTAINER"],
			message: `is required when STORAGE_PROVIDER=${provider} (or set a provider alias: STORAGE_S3_PRIVATE_BUCKET, STORAGE_S3_BUCKET, FIREBASE_STORAGE_BUCKET)`,
		});
	}
	// The local driver keeps objects on one machine's disk and serves them
	// through the API process: no durability, no replication, no CDN.
	if (provider === "local" && isDeployedProduction(env)) {
		context.addIssue({
			code: "custom",
			path: ["STORAGE_PROVIDER"],
			message: "must be s3 or firebase on a deployed production environment (local disk storage is only allowed when APP_URL is localhost)",
		});
	}
	if (provider === "s3") {
		checkS3PublicDeliveryRules(env, context);
	}
}

/**
 * S3 serves public assets (product images, logos, avatars) from a separate
 * public-origin bucket behind CloudFront: the API copies each READY public
 * object there and links to `https://<STORAGE_CLOUDFRONT_PUBLIC_DOMAIN>/<key>`.
 * Both halves are required — without them a public URL would point at a
 * bucket that blocks public access. The distribution id is required too: a
 * withdrawn asset is purged from the CloudFront cache, not left until its TTL.
 */
export function checkS3PublicDeliveryRules(env: ApiEnv, context: z.RefinementCtx<ApiEnv>): void {
	const publicContainer: string | undefined = configuredPublicContainer(env);
	if (publicContainer === undefined) {
		context.addIssue({
			code: "custom",
			path: ["STORAGE_PUBLIC_CONTAINER"],
			message: "is required when STORAGE_PROVIDER=s3: the public-origin bucket CloudFront serves (or set the alias STORAGE_S3_PUBLIC_BUCKET)",
		});
	} else if (publicContainer === configuredPrivateContainer(env)) {
		context.addIssue({
			code: "custom",
			path: ["STORAGE_PUBLIC_CONTAINER"],
			message: "must differ from the private container: public assets are published to their own CloudFront origin bucket",
		});
	}
	if (env.STORAGE_CLOUDFRONT_PUBLIC_DOMAIN === undefined) {
		context.addIssue({
			code: "custom",
			path: ["STORAGE_CLOUDFRONT_PUBLIC_DOMAIN"],
			message: "is required when STORAGE_PROVIDER=s3: public asset URLs are served through CloudFront",
		});
	}
	if (env.STORAGE_CLOUDFRONT_DISTRIBUTION_ID === undefined) {
		context.addIssue({
			code: "custom",
			path: ["STORAGE_CLOUDFRONT_DISTRIBUTION_ID"],
			message: "is required when STORAGE_PROVIDER=s3: deleted public assets are purged from this CloudFront distribution's cache",
		});
	}
}

/** Variables that hold long-lived (static) AWS credentials. */
export const STATIC_AWS_KEY_VARIABLES: readonly ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"] = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"];

/**
 * AWS credentials come from an IAM role through the SDK's default credential
 * chain (ECS task role, EC2 instance profile, EKS IRSA / Pod Identity). Static
 * access keys are a local-development convenience only: on a deployed
 * production environment they are rejected outright, and anywhere else they
 * must come as a complete pair.
 */
export function checkAwsCredentialRules(env: ApiEnv, context: z.RefinementCtx<ApiEnv>): void {
	if (isDeployedProduction(env)) {
		for (const variable of STATIC_AWS_KEY_VARIABLES) {
			if (env[variable] !== undefined) {
				context.addIssue({
					code: "custom",
					path: [variable],
					message:
						"must not be set on a deployed production environment: the API authenticates to AWS with an IAM role (ECS task role, EC2 instance profile or EKS IRSA) through the AWS SDK default credential chain; static access keys are only allowed when APP_URL is localhost",
				});
			}
		}
		return;
	}
	if ((env.AWS_ACCESS_KEY_ID === undefined) !== (env.AWS_SECRET_ACCESS_KEY === undefined)) {
		const missing: keyof ApiEnv = env.AWS_ACCESS_KEY_ID === undefined ? "AWS_ACCESS_KEY_ID" : "AWS_SECRET_ACCESS_KEY";
		context.addIssue({
			code: "custom",
			path: [missing],
			message:
				"must be set together with its AWS key pair counterpart for local development (or leave both unset so the AWS SDK default credential chain resolves an SSO profile or IAM role)",
		});
	}
}

/** Cross-field rules. Each issue names the variable to fix and never echoes a value. */
export function checkApiEnvRules(env: ApiEnv, context: z.RefinementCtx<ApiEnv>): void {
	const isProduction: boolean = env.NODE_ENV === NodeEnvSchema.enum.production;

	requireDistinctSecrets(env, context);
	if (!env.TENANCY_ENABLED && env.DEFAULT_ORGANIZATION_ID === undefined) {
		context.addIssue({
			code: "custom",
			path: ["DEFAULT_ORGANIZATION_ID"],
			message: "is required in single-tenant mode (TENANCY_ENABLED off): the id of the organization this deployment serves (`pnpm db:seed` creates one)",
		});
	}

	for (const issue of listKafkaSecurityEnvIssues(env)) {
		context.addIssue({ code: "custom", path: [issue.variable], message: issue.message });
	}

	if (env.EMAIL_MODE === "send" && env.EMAIL_PROVIDER === "resend" && env.RESEND_API_KEY === undefined) {
		context.addIssue({
			code: "custom",
			path: ["RESEND_API_KEY"],
			message: "is required when EMAIL_MODE=send with EMAIL_PROVIDER=resend (use EMAIL_PROVIDER=mailpit locally, or EMAIL_MODE=log-only / noop, to run without Resend)",
		});
	}
	// Mailpit is a local inbox: on any deployed environment (dev, staging or
	// production, whatever its NODE_ENV) real users would never receive an email.
	if (env.EMAIL_PROVIDER === "mailpit" && !isLoopbackUrl(env.APP_URL)) {
		context.addIssue({
			code: "custom",
			path: ["EMAIL_PROVIDER"],
			message: "must be resend on a deployed environment (the local Mailpit inbox is only allowed when APP_URL is localhost)",
		});
	}
	// A deployed production API must really deliver email: `log-only` would
	// print one-time codes and reset links into the log, and `noop` would
	// report fake "sent" results to every caller.
	const isDeployedProduction: boolean = isProduction && !isLoopbackUrl(env.APP_URL);
	if (isDeployedProduction && env.EMAIL_MODE !== "send") {
		context.addIssue({
			code: "custom",
			path: ["EMAIL_MODE"],
			message: "must be send on a deployed production environment (log-only writes codes and links to the log, noop fakes delivery)",
		});
	}
	// Without the signing secret every Resend delivery webhook is rejected, so
	// bounces and complaints would never reach the email log.
	if (isDeployedProduction && env.EMAIL_MODE === "send" && env.RESEND_WEBHOOK_SECRET === undefined) {
		context.addIssue({
			code: "custom",
			path: ["RESEND_WEBHOOK_SECRET"],
			message: "is required on a deployed production environment with EMAIL_MODE=send (delivery webhooks cannot be verified without it)",
		});
	}
	if (isProduction && env.LOGIN_VERIFICATION_MODE === "disabled") {
		context.addIssue({
			code: "custom",
			path: ["LOGIN_VERIFICATION_MODE"],
			message: "must not switch login verification off in production (new-device verification protects stolen passwords)",
		});
	}
	// EMAIL_TEST_TO redirects every outbound email to one inbox: right for local
	// development (including a production build run on localhost), a silent
	// outage for real users on a deployed environment.
	if (isProduction && env.EMAIL_TEST_TO !== undefined && !isLoopbackUrl(env.APP_URL)) {
		context.addIssue({
			code: "custom",
			path: ["EMAIL_TEST_TO"],
			message: "must not be set on a deployed production environment (it redirects every outbound email to one inbox); it is only allowed when APP_URL is localhost",
		});
	}
	if (isProduction && env.TENANT_KMS_PROVIDER === undefined) {
		context.addIssue({
			code: "custom",
			path: ["TENANT_KMS_PROVIDER"],
			message: "is required in production — choose the provider that wraps tenant data keys explicitly (`local` keeps the key-encryption key in this environment)",
		});
	}
	for (const retiredVersion of Object.keys(env.TENANT_ENCRYPTION_PREVIOUS_MASTER_KEYS ?? {})) {
		if (Number(retiredVersion) >= env.TENANT_ENCRYPTION_MASTER_KEY_VERSION) {
			context.addIssue({
				code: "custom",
				path: ["TENANT_ENCRYPTION_PREVIOUS_MASTER_KEYS"],
				message: "may only hold versions lower than TENANT_ENCRYPTION_MASTER_KEY_VERSION (the current key)",
			});
		}
	}
	if (isProduction && env.REDIS_URL === undefined) {
		context.addIssue({ code: "custom", path: ["REDIS_URL"], message: "is required in production (distributed caches, rate limits and BullMQ need Redis)" });
	}
	checkAwsCredentialRules(env, context);
	if (env.OBSERVE_ENABLED === true && (env.OBSERVE_APP_KEY === undefined || env.OBSERVE_APP_SECRET === undefined)) {
		const missing: keyof ApiEnv = env.OBSERVE_APP_KEY === undefined ? "OBSERVE_APP_KEY" : "OBSERVE_APP_SECRET";
		context.addIssue({ code: "custom", path: [missing], message: "is required when OBSERVE_ENABLED is on" });
	}
	checkStorageRules(env, context);
	checkGithubRules(env, context);
}

/** A repository list needs a token to read it with, stays small, and names each repository once (GitHub names are case-insensitive). */
export function checkGithubRules(env: ApiEnv, context: z.RefinementCtx<ApiEnv>): void {
	checkGithubWebhookRules(env, context);
	const repositories: readonly string[] = env.GITHUB_REPOSITORIES ?? [];
	if (repositories.length === 0) {
		return;
	}
	if (env.GITHUB_TOKEN === undefined) {
		context.addIssue({ code: "custom", path: ["GITHUB_TOKEN"], message: "is required when GITHUB_REPOSITORIES is set (a read-only token for those repositories)" });
	}
	if (repositories.length > GITHUB_REPOSITORIES_MAX) {
		context.addIssue({ code: "custom", path: ["GITHUB_REPOSITORIES"], message: `may list at most ${String(GITHUB_REPOSITORIES_MAX)} repositories` });
	}
	const normalized: readonly string[] = repositories.map((fullName: string): string => fullName.trim().toLowerCase());
	if (new Set(normalized).size !== normalized.length) {
		context.addIssue({ code: "custom", path: ["GITHUB_REPOSITORIES"], message: "must not list the same repository twice" });
	}
}
