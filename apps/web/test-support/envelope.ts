import { epochMs, type ApiResponseMeta, type DataValue, type Envelope } from "@workspace/shared";

/** A fixed response meta, as the API's response interceptor stamps it. */
export const TEST_RESPONSE_META: ApiResponseMeta = { correlationId: "test-correlation", timestamp: epochMs(1_790_000_000_000) };

/** `data` in the API's success envelope (tests only — production passes the server's real envelope). */
export function testEnvelope<Data extends DataValue>(data: Data, meta: ApiResponseMeta = TEST_RESPONSE_META): Envelope<Data> {
	return { success: true, data, meta };
}
