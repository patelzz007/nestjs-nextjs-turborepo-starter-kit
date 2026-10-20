import { AuthClientTypeQuerySchema } from "@workspace/shared";
import { z } from "zod";

import type { AuthFlowMethodArg } from "../../../../platform/presentation/http/security/decorators/track-auth-flow.decorator";

const HeaderValueSchema = z.string();

/**
 * The client type a tracked flow records: the `X-Client-Type` header (the handler's second argument),
 * else the `?client_type=` query (its third). The same precedence the route itself applies.
 */
export function clientTypeFromHeaderOrQuery(_body: AuthFlowMethodArg, header: AuthFlowMethodArg, query: AuthFlowMethodArg): string | null {
	const fromHeader = HeaderValueSchema.safeParse(header);
	if (fromHeader.success) {
		return fromHeader.data;
	}
	const fromQuery = AuthClientTypeQuerySchema.safeParse(query);
	return fromQuery.success ? (fromQuery.data.client_type ?? null) : null;
}
