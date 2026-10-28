import { Injectable, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { z } from "zod";
import { InjectThrottlerOptions, InjectThrottlerStorage, ThrottlerGuard, type ThrottlerModuleOptions, type ThrottlerStorage } from "@nestjs/throttler";

import { LOAD_TEST_KEY_HEADER, LoadTestTrafficKeys } from "../../../../infrastructure/throttling/load-test-traffic-keys";
import { PRE_AUTH_THROTTLER } from "./rate-limit-policy";

/** One non-empty header value (a repeated header arrives as a list, and is ignored). */
const LoadTestKeyHeaderSchema = z.string().min(1);

/** A request's `X-Load-Test-Key` header, if it sent exactly one. */
function loadTestKeyOf(context: ExecutionContext): string | null {
	const header: string | string[] | undefined = context.switchToHttp().getRequest<{ readonly headers: Readonly<Record<string, string | string[] | undefined>> }>().headers[
		LOAD_TEST_KEY_HEADER
	];
	const parsed = LoadTestKeyHeaderSchema.safeParse(header);
	return parsed.success ? parsed.data : null;
}

/**
 * The guards' shared skip rule: a request carrying a live load-test traffic key is a load test's own
 * traffic, already capped by its run (ADR 068), so the per-IP and per-principal buckets do not count it.
 */
abstract class LoadTestAwareThrottlerGuard extends ThrottlerGuard {
	public constructor(
		options: ThrottlerModuleOptions,
		storage: ThrottlerStorage,
		reflector: Reflector,
		private readonly loadTestKeys: LoadTestTrafficKeys,
	) {
		super(options, storage, reflector);
	}

	protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
		const key: string | null = loadTestKeyOf(context);
		return (key !== null && (await this.loadTestKeys.isLive(key))) || super.shouldSkip(context);
	}
}

/**
 * The coarse pre-authentication throttler only (`preAuth`, per client IP).
 * Registered BEFORE `AuthGuard` in `APP_GUARD_ORDER`, so requests with bad or
 * missing credentials are counted before authentication rejects them.
 */
@Injectable()
export class PreAuthThrottlerGuard extends LoadTestAwareThrottlerGuard {
	public constructor(
		@InjectThrottlerOptions() options: ThrottlerModuleOptions,
		@InjectThrottlerStorage() storage: ThrottlerStorage,
		reflector: Reflector,
		loadTestKeys: LoadTestTrafficKeys,
	) {
		super(options, storage, reflector, loadTestKeys);
	}

	public override async onModuleInit(): Promise<void> {
		await super.onModuleInit();
		this.throttlers = this.throttlers.filter((throttler): boolean => throttler.name === PRE_AUTH_THROTTLER);
	}
}

/**
 * Every named throttler except `preAuth` (`strict`, `default`, `webhook`).
 * Registered AFTER `AuthGuard`, so the principal tracker sees `request.user`.
 */
@Injectable()
export class PrincipalThrottlerGuard extends LoadTestAwareThrottlerGuard {
	public constructor(
		@InjectThrottlerOptions() options: ThrottlerModuleOptions,
		@InjectThrottlerStorage() storage: ThrottlerStorage,
		reflector: Reflector,
		loadTestKeys: LoadTestTrafficKeys,
	) {
		super(options, storage, reflector, loadTestKeys);
	}

	public override async onModuleInit(): Promise<void> {
		await super.onModuleInit();
		this.throttlers = this.throttlers.filter((throttler): boolean => throttler.name !== PRE_AUTH_THROTTLER);
	}
}
