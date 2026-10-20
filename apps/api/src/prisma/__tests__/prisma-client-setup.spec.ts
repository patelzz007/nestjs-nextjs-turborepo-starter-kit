import { Logger } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { closePrismaConnections, databasePoolBudget, prismaLogSubscriptions } from "../prisma-client-setup";

describe("databasePoolBudget", () => {
	it("never lets one replica hold more than DB_POOL_MAX connections across both pools", () => {
		for (const total of [2, 3, 9, 10, 25, 100]) {
			const budget = databasePoolBudget(total);
			expect(budget.request + budget.system).toBe(total);
			expect(budget.request).toBeGreaterThanOrEqual(1);
			expect(budget.system).toBeGreaterThanOrEqual(1);
		}
	});

	it("gives the system pool one connection, and a second from a budget of ten", () => {
		expect(databasePoolBudget(9)).toEqual({ request: 8, system: 1 });
		expect(databasePoolBudget(10)).toEqual({ request: 8, system: 2 });
	});
});

describe("prismaLogSubscriptions", () => {
	it("subscribes to query events always, and to info / warn / error only at debug level", () => {
		expect(prismaLogSubscriptions(false)).toEqual([{ emit: "event", level: "query" }]);
		expect(prismaLogSubscriptions(true).map((subscription) => subscription.level)).toEqual(["query", "info", "warn", "error"]);
	});
});

describe("closePrismaConnections", () => {
	it("disconnects Prisma before ending its pool, logging around both", async () => {
		const steps: string[] = [];
		const logger = new Logger("test");
		logger.log = (message: string): void => {
			steps.push(`log:${message}`);
		};

		await closePrismaConnections(
			{ $disconnect: (): Promise<void> => Promise.resolve(void steps.push("disconnect")) },
			{ end: (): Promise<void> => Promise.resolve(void steps.push("end")) },
			logger,
			{ closing: "closing", closed: "closed" },
		);

		expect(steps).toEqual(["log:closing", "disconnect", "end", "log:closed"]);
	});
});
