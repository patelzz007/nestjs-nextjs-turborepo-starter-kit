import type {
	ConcurrencyDecision,
	ConcurrencyLease,
	ConcurrencyRequest,
	RateLimitDecision,
	RateLimiter,
	RateLimitRequest,
	RateLimitSubject,
} from "../../src/platform/application/ports/rate-limiter.port";
import { MemoryRateLimiter } from "../../src/platform/infrastructure/rate-limiting/memory-rate-limiter";

/** One decision the limiter made: what was asked and what it answered. */
export interface RecordedDecision {
	readonly request: RateLimitRequest;
	readonly decision: RateLimitDecision;
}

/** Keys the in-process limiter may hold in a test. */
const TEST_MAX_KEYS = 10_000;

/**
 * The real in-process limiter (same algorithms as the Redis scripts), recording every decision so a
 * test can see which policy counted a request and what it answered. Nothing is stubbed.
 */
export class RecordingRateLimiter implements RateLimiter {
	public readonly decisions: RecordedDecision[] = [];
	private readonly inner: MemoryRateLimiter;

	public constructor(now?: () => number) {
		this.inner = new MemoryRateLimiter({ maxKeys: TEST_MAX_KEYS, ...(now === undefined ? {} : { now }) });
	}

	public async consume(request: RateLimitRequest): Promise<RateLimitDecision> {
		const decision = await this.inner.consume(request);
		this.decisions.push({ request, decision });
		return decision;
	}

	public acquire(request: ConcurrencyRequest): Promise<ConcurrencyDecision> {
		return this.inner.acquire(request);
	}

	public release(lease: ConcurrencyLease): Promise<void> {
		return this.inner.release(lease);
	}

	public liftPenalty(policyName: string, subject: RateLimitSubject): Promise<void> {
		return this.inner.liftPenalty(policyName, subject);
	}

	/** The policies that counted, in order, since the last {@link clear}. */
	public policiesCounted(): string[] {
		return this.decisions.map((recorded: RecordedDecision): string => recorded.request.policyName);
	}

	/** The last decision `policyName` made. */
	public lastDecisionOf(policyName: string): RateLimitDecision | undefined {
		return this.decisions.findLast((recorded: RecordedDecision): boolean => recorded.request.policyName === policyName)?.decision;
	}

	public clear(): void {
		this.decisions.length = 0;
	}
}
