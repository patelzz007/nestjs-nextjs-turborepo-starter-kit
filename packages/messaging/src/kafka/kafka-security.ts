import { z } from "zod";

/**
 * Kafka transport security (TLS + SASL) — the env contract every Kafka client
 * in the repo shares (the API producer and the analytics consumer).
 *
 * Apps compose {@link KafkaSecurityEnvShape} into their own env schema, report
 * {@link listKafkaSecurityEnvIssues} from their `superRefine`, and turn the
 * parsed values into {@link KafkaSecurityOptions} with
 * {@link toKafkaSecurityOptions}. This package still never reads `process.env`.
 */

/** SASL mechanisms the Confluent client supports with a username/password. */
export const KAFKA_SASL_MECHANISMS: ["plain", "scram-sha-256", "scram-sha-512"] = ["plain", "scram-sha-256", "scram-sha-512"];

export const KafkaSaslMechanismSchema = z.enum(KAFKA_SASL_MECHANISMS);

export type KafkaSaslMechanism = z.output<typeof KafkaSaslMechanismSchema>;

/** SASL username/password credentials. */
export interface KafkaSaslCredentials {
	readonly mechanism: KafkaSaslMechanism;
	readonly username: string;
	readonly password: string;
}

/** TLS settings. `caLocation` null = verify the broker against the system trust store. */
export interface KafkaTlsOptions {
	readonly caLocation: string | null;
}

/** How a client authenticates to and encrypts traffic with the brokers. */
export interface KafkaSecurityOptions {
	/** `null` = plaintext transport. */
	readonly tls: KafkaTlsOptions | null;
	/** `null` = no SASL authentication. */
	readonly sasl: KafkaSaslCredentials | null;
}

/** Plaintext, unauthenticated — the local Docker broker (compose.yml). */
export const KAFKA_PLAINTEXT_SECURITY: KafkaSecurityOptions = { tls: null, sasl: null };

const TRUE_FLAG = "true";

/** `"true"` / `"false"`; unset = `false`. */
const KafkaFlagEnvSchema = z
	.enum(["true", "false"], { error: 'must be "true" or "false"' })
	.default("false")
	.transform((value: "true" | "false"): boolean => value === TRUE_FLAG);

const NonEmptyEnvValueSchema = z.string().trim().min(1, "must not be empty");

/**
 * Env variables for Kafka transport security. Spread into an app's env
 * `z.object({...})`; every key is optional so plaintext stays the default.
 */
export const KafkaSecurityEnvShape = {
	/** `true` = TLS to the brokers (`ssl` / `sasl_ssl`). */
	KAFKA_SSL: KafkaFlagEnvSchema,
	/** PEM file with the CA that signed the broker certificates; unset = system trust store. */
	KAFKA_SSL_CA_LOCATION: NonEmptyEnvValueSchema.optional(),
	KAFKA_SASL_MECHANISM: KafkaSaslMechanismSchema.optional(),
	KAFKA_SASL_USERNAME: NonEmptyEnvValueSchema.optional(),
	KAFKA_SASL_PASSWORD: NonEmptyEnvValueSchema.optional(),
};

export const KafkaSecurityEnvSchema = z.object(KafkaSecurityEnvShape);

export type KafkaSecurityEnv = z.output<typeof KafkaSecurityEnvSchema>;

/** One cross-field problem, keyed by the variable to fix. Never carries a value. */
export interface KafkaSecurityEnvIssue {
	readonly variable: keyof KafkaSecurityEnv;
	readonly message: string;
}

/**
 * Cross-field rules a field schema cannot express. Every combination that
 * would be silently ignored, or would send a password in clear text, is an
 * error — so a misconfiguration fails at boot, not at the first publish.
 */
export function listKafkaSecurityEnvIssues(env: KafkaSecurityEnv): KafkaSecurityEnvIssue[] {
	const issues: KafkaSecurityEnvIssue[] = [];
	if (env.KAFKA_SASL_MECHANISM !== undefined) {
		if (env.KAFKA_SASL_USERNAME === undefined) {
			issues.push({ variable: "KAFKA_SASL_USERNAME", message: "is required when KAFKA_SASL_MECHANISM is set" });
		}
		if (env.KAFKA_SASL_PASSWORD === undefined) {
			issues.push({ variable: "KAFKA_SASL_PASSWORD", message: "is required when KAFKA_SASL_MECHANISM is set" });
		}
		if (env.KAFKA_SASL_MECHANISM === "plain" && !env.KAFKA_SSL) {
			issues.push({ variable: "KAFKA_SASL_MECHANISM", message: "plain sends the password in clear text — set KAFKA_SSL=true (or use scram-sha-512)" });
		}
	} else {
		if (env.KAFKA_SASL_USERNAME !== undefined) {
			issues.push({ variable: "KAFKA_SASL_USERNAME", message: "is set but KAFKA_SASL_MECHANISM is not — it would be ignored" });
		}
		if (env.KAFKA_SASL_PASSWORD !== undefined) {
			issues.push({ variable: "KAFKA_SASL_PASSWORD", message: "is set but KAFKA_SASL_MECHANISM is not — it would be ignored" });
		}
	}
	if (env.KAFKA_SSL_CA_LOCATION !== undefined && !env.KAFKA_SSL) {
		issues.push({ variable: "KAFKA_SSL_CA_LOCATION", message: "is set but KAFKA_SSL is not true — it would be ignored" });
	}
	return issues;
}

/** Thrown when security options are built from env that {@link listKafkaSecurityEnvIssues} rejects. */
export class InvalidKafkaSecurityEnvError extends Error {
	public constructor(public readonly issues: readonly KafkaSecurityEnvIssue[]) {
		super(`Invalid Kafka security configuration: ${issues.map((issue: KafkaSecurityEnvIssue): string => `${issue.variable} ${issue.message}`).join("; ")}`);
		this.name = "InvalidKafkaSecurityEnvError";
	}
}

/** Parsed env → client security options. Throws {@link InvalidKafkaSecurityEnvError} on an inconsistent combination. */
export function toKafkaSecurityOptions(env: KafkaSecurityEnv): KafkaSecurityOptions {
	const issues = listKafkaSecurityEnvIssues(env);
	if (issues.length > 0) {
		throw new InvalidKafkaSecurityEnvError(issues);
	}
	const tls: KafkaTlsOptions | null = env.KAFKA_SSL ? { caLocation: env.KAFKA_SSL_CA_LOCATION ?? null } : null;
	if (env.KAFKA_SASL_MECHANISM === undefined || env.KAFKA_SASL_USERNAME === undefined || env.KAFKA_SASL_PASSWORD === undefined) {
		return { tls, sasl: null };
	}
	return { tls, sasl: { mechanism: env.KAFKA_SASL_MECHANISM, username: env.KAFKA_SASL_USERNAME, password: env.KAFKA_SASL_PASSWORD } };
}
