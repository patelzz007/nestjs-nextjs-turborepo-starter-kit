import { describe, expect, it } from "vitest";

import { RequestContextService, type RequestContextSeed } from "../../platform/infrastructure/context/request-context";
import { rlsStorage, systemRlsContext, userRlsContext } from "../rls-context";
import { applyRlsSession, type RlsSessionConnection } from "../rls-pool";

/** One statement the pool checkout sent: the SQL and its bind parameters. */
interface SentQuery {
	readonly sql: string;
	readonly values: readonly string[];
}

/** A connection that records what the checkout stamps on it. */
class RecordingClient implements RlsSessionConnection {
	public readonly sent: SentQuery[] = [];

	public async query(sql: string, values: string[]): Promise<object> {
		this.sent.push({ sql, values });
		return Promise.resolve({ rowCount: 1 });
	}

	/** The value set for one `app.*` / `role` setting. */
	public setting(name: string): string | undefined {
		return this.sent.find((query: SentQuery): boolean => query.sql.includes(`'${name}'`))?.values.at(0);
	}
}

const SEED: RequestContextSeed = { correlationId: "corr-pool-1", ip: "203.0.113.7", userAgent: "vitest", edgeLocation: undefined };

describe("applyRlsSession", () => {
	const requestContext = new RequestContextService();

	it("stamps the user scope and the current request's correlation id", async () => {
		const client = new RecordingClient();
		await requestContext.run(SEED, () => rlsStorage.run(userRlsContext("user-1", "org-a", false), () => applyRlsSession(client)));

		expect(client.setting("role")).toBe("app_runtime");
		expect(client.setting("app.current_user_id")).toBe("user-1");
		expect(client.setting("app.current_organization_id")).toBe("org-a");
		expect(client.setting("app.correlation_id")).toBe("corr-pool-1");
	});

	it("clears the correlation id outside a request, so a reused connection never carries the previous request's id", async () => {
		const client = new RecordingClient();
		await rlsStorage.run(systemRlsContext("queue.email.send"), () => applyRlsSession(client));

		expect(client.setting("app.system_operation")).toBe("queue.email.send");
		expect(client.setting("app.correlation_id")).toBe("");
	});

	it("refuses a tenant-scoped checkout without a bound organization", async () => {
		const client = new RecordingClient();

		await expect(rlsStorage.run(userRlsContext("user-1", null, true), () => applyRlsSession(client))).rejects.toThrow(/organization context/);
		expect(client.sent).toEqual([]);
	});
});
