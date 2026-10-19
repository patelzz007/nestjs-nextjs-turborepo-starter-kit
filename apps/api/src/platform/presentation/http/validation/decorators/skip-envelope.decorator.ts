import { SetMetadata } from "@nestjs/common";

/**
 * Metadata key for the @SkipEnvelope() decorator.
 * When set, the ResponseInterceptor skips the { success, data, meta } wrapper
 * and returns the raw response body.
 */
export const SKIP_ENVELOPE = "SKIP_ENVELOPE";

/**
 * Decorator: bypass the standard { success, data, meta } response envelope.
 *
 * Use this on endpoints that return raw data (e.g. file downloads, SSE streams,
 * webhook responses) where the envelope wrapper would break the contract.
 *
 * @example
 *   @SkipEnvelope()
 *   @Get('export')
 *   exportData() { ... }
 */
export const SkipEnvelope = (): MethodDecorator => SetMetadata(SKIP_ENVELOPE, true);
