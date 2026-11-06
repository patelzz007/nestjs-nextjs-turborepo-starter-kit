import { epochMs, type ApiResponseMeta, type DataValue, type Envelope } from "@workspace/shared";

/** Fixed clock for envelope fixtures (2026-10-01T00:00:00Z). */
const ENVELOPE_FIXTURE_NOW = 1_790_812_800_000;

/** The meta a test API answer carries — a fixture standing in for the server's own meta. */
export const TEST_RESPONSE_META: ApiResponseMeta = { correlationId: "test-correlation-id", timestamp: epochMs(ENVELOPE_FIXTURE_NOW) };

/** A success envelope as the API would send it, for mocked query results in tests. */
export function testEnvelope<TData extends DataValue>(data: TData, meta: ApiResponseMeta = TEST_RESPONSE_META): Envelope<TData> {
	return { success: true, data, meta };
}
