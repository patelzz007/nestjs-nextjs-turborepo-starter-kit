// Operation descriptions of the analytics routes. The generated API reference
// lists every `<status> <CODE>` quoted here in the endpoint's error table
// (docs/technical/api/README.md → "How the reference is generated").
import { ANALYTICS_EXPORT_RATE_LIMIT, ANALYTICS_EXPORT_RATE_LIMIT_WINDOW_MS, MAX_ANALYTICS_RANGE_DAYS } from "@workspace/shared";

const MS_PER_MINUTE = 60_000;

const RANGE_RULE = `Range: \`from\` (inclusive) / \`to\` (exclusive) epoch ms, at most ${String(MAX_ANALYTICS_RANGE_DAYS)} days (else 400 VALIDATION_ERROR)`;
const TIMEOUT_RULE = "A report query over its time budget answers 503 ANALYTICS_QUERY_TIMEOUT.";

/** Description of the three dashboard routes (customer, merchant, admin). */
export const ANALYTICS_DASHBOARD_OPERATION_DESCRIPTION = `${RANGE_RULE}; \`interval\` (day | week | month) defaults from the range length. Every number is computed in Postgres; buckets are cut in \`range.timeZone\`. ${TIMEOUT_RULE}`;

/** Description of the two export routes (merchant, admin). */
export const ANALYTICS_EXPORT_OPERATION_DESCRIPTION = `The body is the file (Content-Disposition: attachment). ${RANGE_RULE}; both bounds are required. Each export writes an audit row and is limited to ${String(ANALYTICS_EXPORT_RATE_LIMIT)} per caller per ${String(ANALYTICS_EXPORT_RATE_LIMIT_WINDOW_MS / MS_PER_MINUTE)} minutes: 429 ANALYTICS_EXPORT_RATE_LIMITED with \`Retry-After\`. ${TIMEOUT_RULE}`;
