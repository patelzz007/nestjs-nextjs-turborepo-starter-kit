import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Request-scoped correlation id accessible from workers and event bridges.
 * HTTP middleware / interceptors set the value per request.
 */
@Injectable()
export class CorrelationContextService {
	private readonly storage: AsyncLocalStorage<string | undefined> = new AsyncLocalStorage();

	public run<T>(correlationId: string | undefined, callback: () => T): T {
		return this.storage.run(correlationId, callback);
	}

	public set(correlationId: string | undefined): void {
		this.storage.enterWith(correlationId);
	}

	public get(): string | undefined {
		return this.storage.getStore();
	}
}
