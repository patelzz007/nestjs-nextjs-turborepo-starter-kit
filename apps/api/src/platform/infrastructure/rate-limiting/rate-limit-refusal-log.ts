// ============================================
// platform/infrastructure/rate-limiting/rate-limit-refusal-log.ts — every refusal, logged and kept briefly
// ============================================
// ADR 071: each refusal is one `rate_limit.refused` log line (policy and subject kind, never an address
// or destination) and one entry in a capped Redis stream (the last ~10,000), which the admin Rate limits
// page reads. Subjects are stored masked; beside each, an opaque reference (an HMAC of the subject) maps
// to the raw subject for a day in Redis, so "Lift penalty" works from a masked row without the address or
// id ever leaving the server.

import { createHmac } from "node:crypto";

import { Inject, Injectable, Logger } from "@nestjs/common";
import type Redis from "ioredis";
import { z } from "zod";

import { TypedConfigService } from "../../../config/typed-config.service";
import type { RateLimitSubject, RateLimitSubjectKind } from "../../application/ports/rate-limiter.port";
import type { RateLimitRefusalsPort } from "../../application/ports/rate-limit-insights.port";
import { REDIS_PUBLISHER } from "../redis/redis.tokens";

/** Entries the stream keeps (approximate trim, `MAXLEN ~`). */
export const REFUSAL_STREAM_MAX_ENTRIES = 10_000;

/** How long a subject reference resolves: the penalties it lifts last at most a day. */
export const SUBJECT_REF_TTL_SECONDS = 86_400;
/** Hex characters of a subject reference (128 bits). */
const SUBJECT_REF_LENGTH = 32;
const SUBJECT_REF_PURPOSE = "rate-limits.subject-ref.v1";

/** Characters of an id kept before the mask. */
const VISIBLE_ID_CHARACTERS = 8;
const IPV4_SEPARATOR = ".";
const MASK = "•";

export interface RateLimitRefusal {
	readonly policyName: string;
	readonly subject: RateLimitSubject;
	readonly penalized: boolean;
}

export interface RecordedRefusal {
	readonly policyName: string;
	readonly subjectKind: RateLimitSubjectKind;
	readonly maskedSubject: string;
	/** Opaque: {@link RateLimitRefusalLog.resolveSubject} turns it back into the subject for a day. */
	readonly subjectRef: string;
	readonly penalized: boolean;
	readonly atEpochMs: number;
}

const SubjectKindSchema = z.enum(["ip", "principal", "tenant", "apiKey", "destination"]);
const StreamFieldsSchema = z.tuple([
	z.literal("policy"),
	z.string(),
	z.literal("kind"),
	SubjectKindSchema,
	z.literal("subject"),
	z.string(),
	z.literal("penalized"),
	z.enum(["0", "1"]),
	z.literal("ref"),
	z.string(),
]);
const StreamEntrySchema = z.tuple([z.string(), StreamFieldsSchema]);
/** Entries are parsed one by one: one written by an older version is skipped, never fatal. */
const RawStreamEntriesSchema = z.array(z.tuple([z.string(), z.array(z.string())]));
const ReferencedSubjectSchema = z.object({ policyName: z.string(), kind: SubjectKindSchema, id: z.string() });

/** A policy's subject, from a refusal's reference. */
export interface ReferencedSubject {
	readonly policyName: string;
	readonly subject: RateLimitSubject;
}

/** An address or id with its identifying part hidden: `203.0.113.•`, `user:0193ab12•`. */
export function maskSubject(subject: RateLimitSubject): string {
	if (subject.kind === "ip" && subject.id.includes(IPV4_SEPARATOR)) {
		return [...subject.id.split(IPV4_SEPARATOR).slice(0, -1), MASK].join(IPV4_SEPARATOR);
	}
	return `${subject.id.slice(0, VISIBLE_ID_CHARACTERS)}${MASK}`;
}

@Injectable()
export class RateLimitRefusalLog implements RateLimitRefusalsPort {
	private readonly logger: Logger = new Logger("RateLimit");

	private readonly refKey: Buffer;

	public constructor(
		private readonly config: TypedConfigService,
		@Inject(REDIS_PUBLISHER) private readonly redis: Redis | null,
	) {
		this.refKey = createHmac("sha256", config.auth.emailVerificationSecret).update(SUBJECT_REF_PURPOSE).digest();
	}

	/** Never throws: a lost log entry must not turn a 429 into a 500. */
	public async record(refusal: RateLimitRefusal): Promise<void> {
		this.logger.warn(`rate_limit.refused policy=${refusal.policyName} subjectKind=${refusal.subject.kind} penalized=${String(refusal.penalized)}`);
		if (this.redis === null) {
			return;
		}
		const ref = this.subjectRef(refusal.policyName, refusal.subject);
		try {
			await this.redis.set(
				this.refKeyOf(ref),
				JSON.stringify({ policyName: refusal.policyName, kind: refusal.subject.kind, id: refusal.subject.id }),
				"EX",
				SUBJECT_REF_TTL_SECONDS,
			);
			await this.redis.xadd(
				this.streamKey(),
				"MAXLEN",
				"~",
				REFUSAL_STREAM_MAX_ENTRIES,
				"*",
				"policy",
				refusal.policyName,
				"kind",
				refusal.subject.kind,
				"subject",
				maskSubject(refusal.subject),
				"penalized",
				refusal.penalized ? "1" : "0",
				"ref",
				ref,
			);
		} catch (error) {
			this.logger.warn("rate_limit.refusal_log_unavailable", error);
		}
	}

	/** The newest refusals since `sinceEpochMs`, newest first, at most `limit`. Empty without Redis. */
	public async recent(sinceEpochMs: number, limit: number): Promise<RecordedRefusal[]> {
		if (this.redis === null) {
			return [];
		}
		const raw = RawStreamEntriesSchema.parse(await this.redis.xrevrange(this.streamKey(), "+", String(sinceEpochMs), "COUNT", limit));
		return raw.flatMap((entry): RecordedRefusal[] => {
			const parsed = StreamEntrySchema.safeParse(entry);
			if (!parsed.success) {
				return [];
			}
			const [id, [, policyName, , subjectKind, , maskedSubject, , penalized, , subjectRef]] = parsed.data;
			const epochMs = /^(?<epochMs>\d+)-\d+$/.exec(id)?.groups?.epochMs ?? "0";
			return [{ policyName, subjectKind, maskedSubject, subjectRef, penalized: penalized === "1", atEpochMs: Number(epochMs) }];
		});
	}

	/** The policy and subject a refusal's reference names, while it lasts (a day); null once gone or unknown. */
	public async resolveSubject(subjectRef: string): Promise<ReferencedSubject | null> {
		if (this.redis === null) {
			return null;
		}
		const stored = await this.redis.get(this.refKeyOf(subjectRef));
		if (stored === null) {
			return null;
		}
		const parsed = ReferencedSubjectSchema.safeParse(JSON.parse(stored));
		return parsed.success ? { policyName: parsed.data.policyName, subject: { kind: parsed.data.kind, id: parsed.data.id } } : null;
	}

	/** The same subject of the same policy always gets the same reference (the rows group by it). */
	public subjectRef(policyName: string, subject: RateLimitSubject): string {
		return createHmac("sha256", this.refKey).update(`${policyName}\n${subject.kind}\n${subject.id}`).digest("hex").slice(0, SUBJECT_REF_LENGTH);
	}

	private refKeyOf(subjectRef: string): string {
		return this.config.redisNamespace.key(`rl:ref:${subjectRef}`);
	}

	private streamKey(): string {
		return this.config.redisNamespace.key("rl:refusals");
	}
}
