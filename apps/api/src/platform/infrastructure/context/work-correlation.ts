import { AsyncLocalStorage } from "node:async_hooks";

import { Injectable } from "@nestjs/common";

import type { CorrelationScopePort } from "../../application/ports/correlation-scope.port";
import { generateCorrelationId } from "./correlation-id";
import { RequestContextService } from "./request-context";

/** The correlation id of the background work in progress (outside an HTTP request). */
const workCorrelationStorage: AsyncLocalStorage<string> = new AsyncLocalStorage<string>();

/** The id {@link AsyncLocalCorrelationScope} opened for the current background work, or `undefined`. */
export function currentWorkCorrelationId(): string | undefined {
	return workCorrelationStorage.getStore();
}

/**
 * Reuses the request's correlation id (or the enclosing work's), otherwise
 * opens a fresh one for `work`. `TenantTransactionService` reads the same id,
 * so every transaction inside `work` stamps it as `app.correlation_id`.
 */
@Injectable()
export class AsyncLocalCorrelationScope implements CorrelationScopePort {
	public constructor(private readonly requestContext: RequestContextService) {}

	public run<TResult>(work: (correlationId: string) => Promise<TResult>): Promise<TResult> {
		const existing: string | undefined = this.requestContext.correlationId() ?? currentWorkCorrelationId();
		if (existing !== undefined) {
			return work(existing);
		}
		const correlationId: string = generateCorrelationId();
		return workCorrelationStorage.run(correlationId, () => work(correlationId));
	}
}
