import { describe, expect, it } from "vitest";

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

describe("applyRlsSession", () => {
	it("switches to the restricted role and does not copy a bound user onto the connection", async () => {
		const client = new RecordingClient();
		await rlsStorage.run(userRlsContext("user-1", "org-a", false), () => applyRlsSession(client));

		expect(client.setting("role")).toBe("app_runtime");
		expect(client.setting("app.current_user_id")).toBeUndefined();
		expect(client.setting("app.current_tenant_id")).toBeUndefined();
		expect(client.setting("app.rls_bypass")).toBeUndefined();
		expect(client.setting("app.correlation_id")).toBeUndefined();
		expect(client.sent).toHaveLength(1);
	});

	it("does not copy a system operation onto the connection", async () => {
		const client = new RecordingClient();
		await rlsStorage.run(systemRlsContext("queue.email.send"), () => applyRlsSession(client));

		expect(client.setting("role")).toBe("app_runtime");
		expect(client.setting("app.system_operation")).toBeUndefined();
	});

	it("still checks out when the bound user has no tenant; the transaction service owns that refusal", async () => {
		const client = new RecordingClient();

		await expect(rlsStorage.run(userRlsContext("user-1", null, true), () => applyRlsSession(client))).resolves.toBeUndefined();
		expect(client.setting("role")).toBe("app_runtime");
		expect(client.setting("app.current_tenant_id")).toBeUndefined();
	});
});
