import { KafkaJS } from "@confluentinc/kafka-javascript";
import { z } from "zod";

import type { KafkaSecurityOptions } from "./kafka-security";

/** Where the Kafka client's own diagnostics go (one structured line each). */
export interface KafkaLogSink {
	error(message: string, context: KafkaLogContext): void;
	warn(message: string, context: KafkaLogContext): void;
	info(message: string, context: KafkaLogContext): void;
	debug(message: string, context: KafkaLogContext): void;
}

/** Structured context attached to every client log line. */
export interface KafkaLogContext {
	/** Client-side component (`producer`, `consumer`, `admin`, …) when the library names one. */
	readonly namespace: string | null;
	/** librdkafka log facility (`BROKERFAIL`, `REQTMOUT`, …) when present. */
	readonly facility: string | null;
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
	readonly facility: string | null;
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
		facility: context.facility,
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

/** The fields librdkafka attaches to a log line that are worth keeping. */
const KafkaLogExtraSchema = z.object({ fac: z.string().optional() });

function facilityOf(extra: object | undefined): string | null {
	const parsed = KafkaLogExtraSchema.safeParse(extra);
	return parsed.success ? (parsed.data.fac ?? null) : null;
}

/**
 * Adapts a structured sink to the client's logger interface, so its
 * diagnostics land in the app's JSON logs instead of raw console output.
 * `setLogLevel` filters lines below the chosen level.
 */
export function createKafkaLogger(sink: KafkaLogSink, initialLevel: KafkaJS.logLevel, namespace: string | null = null): KafkaJS.Logger {
	let level: KafkaJS.logLevel = initialLevel;
	const context = (extra: object | undefined): KafkaLogContext => ({ namespace, facility: facilityOf(extra), repeats: null });
	return {
		error: (message: string, extra?: object): void => {
			if (level >= KafkaJS.logLevel.ERROR) sink.error(message, context(extra));
		},
		warn: (message: string, extra?: object): void => {
			if (level >= KafkaJS.logLevel.WARN) sink.warn(message, context(extra));
		},
		info: (message: string, extra?: object): void => {
			if (level >= KafkaJS.logLevel.INFO) sink.info(message, context(extra));
		},
		debug: (message: string, extra?: object): void => {
			if (level >= KafkaJS.logLevel.DEBUG) sink.debug(message, context(extra));
		},
		namespace: (childNamespace: string, childLevel?: KafkaJS.logLevel): KafkaJS.Logger => createKafkaLogger(sink, childLevel ?? level, childNamespace),
		setLogLevel: (nextLevel: KafkaJS.logLevel): void => {
			level = nextLevel;
		},
	};
}

/** Where the client's diagnostics go, and from which level on. */
export interface KafkaClientLogOptions {
	readonly sink: KafkaLogSink;
	readonly level: KafkaJS.logLevel;
}

/** Everything needed to open a Kafka client — passed explicitly, never read from the environment. */
export interface KafkaConnectionOptions {
	readonly clientId: string;
	readonly brokers: readonly string[];
	readonly security: KafkaSecurityOptions;
	readonly log: KafkaClientLogOptions;
}

/**
 * Builds the Confluent client config: the KafkaJS-compatible block (brokers,
 * client id, TLS on/off, SASL, logger + level) plus the librdkafka properties
 * the compat block cannot carry (the CA file). TLS certificate verification
 * stays ON — there is deliberately no switch to disable it.
 *
 * The level is set in TWO places on purpose, from one value: on the logger
 * adapter and as the compat block's `logLevel`. Every client (producer,
 * consumer, admin) calls `logger.setLogLevel(<librdkafka log_level>)` when it
 * connects, and without `logLevel` that is INFO — which would silently
 * override the adapter's level and let INFO chatter through.
 */
export function buildKafkaClientConfig(options: KafkaConnectionOptions): KafkaJS.CommonConstructorConfig {
	const { tls, sasl } = options.security;
	const caLocation: string | null = tls?.caLocation ?? null;
	const kafkaJS: KafkaJS.KafkaConfig = {
		clientId: options.clientId,
		brokers: [...options.brokers],
		logger: createKafkaLogger(options.log.sink, options.log.level),
		logLevel: options.log.level,
		...(tls === null ? {} : { ssl: true }),
		...(sasl === null ? {} : { sasl: { mechanism: sasl.mechanism, username: sasl.username, password: sasl.password } }),
	};
	return {
		kafkaJS,
		...(caLocation === null ? {} : { "ssl.ca.location": caLocation }),
	};
}
