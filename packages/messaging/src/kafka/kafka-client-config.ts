import { readFileSync } from "node:fs";

import { SASLMechanisms, type BaseOptions, type SASLMechanismValue } from "@platformatic/kafka";

import type { KafkaSaslMechanism, KafkaSecurityOptions } from "./kafka-security";

/** Where the Kafka client's own diagnostics go (one structured line each). */
export interface KafkaLogSink {
	error(message: string, context: KafkaLogContext): void;
	warn(message: string, context: KafkaLogContext): void;
	info(message: string, context: KafkaLogContext): void;
	debug(message: string, context: KafkaLogContext): void;
}

/** Structured context attached to every client log line. */
export interface KafkaLogContext {
	/** The client that reported it (`producer`, `admin`, `consumer`). */
	readonly namespace: string | null;
	/** The client event behind the line (`client:broker:failed`, `consumer:heartbeat:error`, …). */
	readonly clientEvent: string | null;
	/**
	 * `null` on a line as the client emitted it. Set on the summary line an
	 * aggregating sink emits for a diagnostic that repeated inside its window
	 * (see `AggregatingKafkaLogSink`): `count` further occurrences in `windowMs`.
	 */
	readonly repeats: KafkaLogRepeats | null;
}

/** How often a diagnostic repeated after its first line, inside one aggregation window. */
export interface KafkaLogRepeats {
	readonly count: number;
	readonly windowMs: number;
}

/** The structured `kafka.client_log` entry one client diagnostic becomes (summary lines add the repeat counts). */
export interface KafkaClientLogEntry {
	readonly event: "kafka.client_log";
	readonly namespace: string | null;
	readonly clientEvent: string | null;
	readonly message: string;
	readonly repeatCount?: number;
	readonly repeatWindowMs?: number;
}

/** Writes one structured client log entry at a given level. */
export type KafkaClientLogWriter = (entry: KafkaClientLogEntry) => void;

/**
 * Builds a {@link KafkaLogSink} that turns every diagnostic into a
 * {@link KafkaClientLogEntry} and hands it to the writer of its level —
 * shared by the API producer (Nest logger) and the analytics consumer (JSON logger).
 */
export function kafkaLogSinkFrom(writers: Readonly<Record<keyof KafkaLogSink, KafkaClientLogWriter>>): KafkaLogSink {
	const entry = (message: string, context: KafkaLogContext): KafkaClientLogEntry => ({
		event: "kafka.client_log",
		namespace: context.namespace,
		clientEvent: context.clientEvent,
		message,
		...(context.repeats === null ? {} : { repeatCount: context.repeats.count, repeatWindowMs: context.repeats.windowMs }),
	});
	return {
		error: (message: string, context: KafkaLogContext): void => {
			writers.error(entry(message, context));
		},
		warn: (message: string, context: KafkaLogContext): void => {
			writers.warn(entry(message, context));
		},
		info: (message: string, context: KafkaLogContext): void => {
			writers.info(entry(message, context));
		},
		debug: (message: string, context: KafkaLogContext): void => {
			writers.debug(entry(message, context));
		},
	};
}

/** A broker address as the client reports it. */
export interface KafkaBrokerAddress {
	readonly host: string;
	readonly port: number;
}

/** What the client hands to a `client:broker:failed` listener (the part worth logging). */
export interface KafkaBrokerFailure {
	readonly broker: KafkaBrokerAddress;
}

/** Client events every Kafka client (producer, admin, consumer) emits that are worth a log line. */
export interface KafkaClientEventSource {
	on(event: "client:broker:failed", listener: (payload: KafkaBrokerFailure) => void): void;
	on(event: "error", listener: (error: Error) => void): void;
}

/** The client event names {@link observeKafkaClient} listens to. */
export const KAFKA_BROKER_FAILED_EVENT = "client:broker:failed";
export const KAFKA_CLIENT_ERROR_EVENT = "error";

/**
 * Routes a client's own diagnostics into a structured sink: a broker it could
 * not reach (warn — the client retries) and any `error` it emits (error — and
 * an `error` with no listener would crash the process). A broker that stays
 * down fails every retry; pass an `AggregatingKafkaLogSink` to fold that storm.
 */
export function observeKafkaClient(client: KafkaClientEventSource, sink: KafkaLogSink, namespace: string): void {
	client.on(KAFKA_BROKER_FAILED_EVENT, (payload: KafkaBrokerFailure): void => {
		sink.warn(`Connection to broker ${payload.broker.host}:${String(payload.broker.port)} failed`, { namespace, clientEvent: KAFKA_BROKER_FAILED_EVENT, repeats: null });
	});
	client.on(KAFKA_CLIENT_ERROR_EVENT, (error: Error): void => {
		sink.error(error.message, { namespace, clientEvent: KAFKA_CLIENT_ERROR_EVENT, repeats: null });
	});
}

/** Budget for one broker request (ms) when the caller sets none — the client's own default. */
export const DEFAULT_KAFKA_REQUEST_TIMEOUT_MS = 5_000;

/**
 * How many times the client retries a failed request, and how long it waits in between.
 * Always set explicitly: with the client's defaults (`@platformatic/kafka` 2.16.0), a
 * send to — or a metadata read of — a topic the broker does not know never settled
 * (measured: still pending after 140 s); with these it fails within a second.
 */
export const KAFKA_CLIENT_RETRIES = 3;
export const KAFKA_CLIENT_RETRY_DELAY_MS = 250;

/** Everything needed to open a Kafka client — passed explicitly, never read from the environment. */
export interface KafkaConnectionOptions {
	readonly clientId: string;
	readonly brokers: readonly string[];
	readonly security: KafkaSecurityOptions;
	/** Budget for one broker request (ms); {@link DEFAULT_KAFKA_REQUEST_TIMEOUT_MS} when unset. */
	readonly requestTimeoutMs?: number;
}

/** The client options every Kafka client in the repo shares (connection, security, retries). */
export type KafkaClientOptions = Pick<BaseOptions, "clientId" | "bootstrapBrokers" | "timeout" | "retries" | "retryDelay" | "tls" | "sasl">;

const SASL_MECHANISM_VALUES: Readonly<Record<KafkaSaslMechanism, SASLMechanismValue>> = {
	plain: SASLMechanisms.PLAIN,
	"scram-sha-256": SASLMechanisms.SCRAM_SHA_256,
	"scram-sha-512": SASLMechanisms.SCRAM_SHA_512,
};

/** Reads the CA bundle a TLS connection verifies the brokers against. */
export type KafkaCaFileReader = (path: string) => Buffer;

const readCaFile: KafkaCaFileReader = (path: string): Buffer => readFileSync(path);

/**
 * Builds the shared client options: brokers, client id, request timeout,
 * explicit retries, TLS and SASL. TLS verifies the broker certificates (against
 * the CA file when one is set, otherwise the system trust store) — there is
 * deliberately no switch to turn verification off.
 */
export function buildKafkaClientOptions(options: KafkaConnectionOptions, readCa: KafkaCaFileReader = readCaFile): KafkaClientOptions {
	const { tls, sasl } = options.security;
	return {
		clientId: options.clientId,
		bootstrapBrokers: [...options.brokers],
		timeout: options.requestTimeoutMs ?? DEFAULT_KAFKA_REQUEST_TIMEOUT_MS,
		retries: KAFKA_CLIENT_RETRIES,
		retryDelay: KAFKA_CLIENT_RETRY_DELAY_MS,
		...(tls === null ? {} : { tls: tls.caLocation === null ? {} : { ca: readCa(tls.caLocation) } }),
		...(sasl === null ? {} : { sasl: { mechanism: SASL_MECHANISM_VALUES[sasl.mechanism], username: sasl.username, password: sasl.password } }),
	};
}
