import { afterEach, describe, expect, it } from "vitest";

import { escapeLibpqOptionValue, CONSUMER_ACTOR, CONSUMER_APPLICATION_NAME, createConsumerPool } from "../pg-inbox-store";

describe("createConsumerPool", () => {
	const pools: { end(): Promise<void> }[] = [];

	afterEach(async () => {
		await Promise.all(pools.map((pool) => pool.end()));
		pools.length = 0;
	});

	it("bounds the pool size and every wait from configuration (no unbounded defaults)", () => {
		const pool = createConsumerPool("postgresql://analytics_consumer_app:pw@localhost:5432/db", {
			max: 7,
			connectionTimeoutMs: 1_500,
			idleTimeoutMs: 20_000,
			statementTimeoutMs: 9_000,
		});
		pools.push(pool);

		expect(pool.options).toMatchObject({
			max: 7,
			connectionTimeoutMillis: 1_500,
			idleTimeoutMillis: 20_000,
			statement_timeout: 9_000,
			application_name: CONSUMER_APPLICATION_NAME,
		});
	});

	it("names the consumer as the actor of its writes, for the row-audit columns", () => {
		const pool = createConsumerPool("postgresql://analytics_consumer_app:pw@localhost:5432/db", {
			max: 1,
			connectionTimeoutMs: 1_000,
			idleTimeoutMs: 1_000,
			statementTimeoutMs: 1_000,
		});
		pools.push(pool);

		expect(pool.options).toMatchObject({ options: `-c app.actor=${CONSUMER_ACTOR}` });
	});
});

describe("escapeLibpqOptionValue", () => {
	it("leaves a plain value alone", () => {
		expect(escapeLibpqOptionValue("system:analytics-consumer")).toBe("system:analytics-consumer");
	});

	it("escapes whitespace and backslashes, which would otherwise split the options string", () => {
		expect(escapeLibpqOptionValue("system: analytics\\consumer")).toBe("system:\\ analytics\\\\consumer");
	});
});
