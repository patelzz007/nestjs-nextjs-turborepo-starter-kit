import { afterEach, describe, expect, it, vi, type MockInstance } from "vitest";

import { DependencyUnavailableError } from "../common/errors/app-error";
import { createTestTypedConfig } from "../../test/support/test-api-env";

import { PrismaService } from "./prisma.service";

/** A PrismaService whose `$connect` / `SELECT 1` are controlled by the test — no database is touched. */
function createService(): {
	readonly prisma: PrismaService;
	readonly connect: MockInstance<PrismaService["$connect"]>;
	readonly ping: MockInstance<PrismaService["$queryRaw"]>;
} {
	const prisma = new PrismaService(createTestTypedConfig());
	const connect = vi.spyOn(prisma, "$connect").mockResolvedValue();
	const ping = vi.spyOn(prisma, "$queryRaw").mockResolvedValue([]);
	return { prisma, connect, ping };
}

describe("PrismaService connection lifecycle", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("verifies the connection with a real round trip before reporting it ready", async () => {
		const { prisma, connect, ping } = createService();
		prisma.onModuleInit();

		await expect(prisma.ensureConnected()).resolves.toBeUndefined();
		expect(connect).toHaveBeenCalledTimes(1);
		expect(ping).toHaveBeenCalledTimes(1);
	});

	it("fails ensureConnected() loudly with a 503 when the database stays unreachable", async () => {
		const { prisma, connect } = createService();
		connect.mockRejectedValue(new Error("ECONNREFUSED"));
		prisma.onModuleInit();

		await expect(prisma.ensureConnected()).rejects.toBeInstanceOf(DependencyUnavailableError);
		await expect(prisma.ensureConnected()).rejects.toMatchObject({ httpStatus: 503, cause: expect.objectContaining({ message: "ECONNREFUSED" }) });
	});

	it("treats a failed round trip as a failed connection, not a success", async () => {
		const { prisma, ping } = createService();
		ping.mockRejectedValue(new Error("password authentication failed"));
		prisma.onModuleInit();

		await expect(prisma.ensureConnected()).rejects.toBeInstanceOf(DependencyUnavailableError);
	});

	it("recovers once the database comes back after a failed boot-time attempt", async () => {
		const { prisma, connect } = createService();
		connect.mockRejectedValueOnce(new Error("ECONNREFUSED"));
		prisma.onModuleInit();

		await expect(prisma.ensureConnected()).resolves.toBeUndefined();
		expect(connect).toHaveBeenCalledTimes(2);
		await expect(prisma.ensureConnected()).resolves.toBeUndefined();
		expect(connect).toHaveBeenCalledTimes(2);
	});

	it("shares one retry between concurrent callers", async () => {
		const { prisma, connect } = createService();
		connect.mockRejectedValueOnce(new Error("ECONNREFUSED"));
		prisma.onModuleInit();

		await Promise.all([prisma.ensureConnected(), prisma.ensureConnected(), prisma.ensureConnected()]);
		expect(connect).toHaveBeenCalledTimes(2);
	});

	it("connects on demand when no boot-time attempt was started, instead of waiting forever", async () => {
		const { prisma, connect } = createService();

		await expect(prisma.ensureConnected()).resolves.toBeUndefined();
		expect(connect).toHaveBeenCalledTimes(1);
	});

	it("never leaves a failed background attempt as an unhandled rejection", async () => {
		const unhandled = vi.fn();
		process.on("unhandledRejection", unhandled);
		const { prisma, connect } = createService();
		connect.mockRejectedValue(new Error("ECONNREFUSED"));

		prisma.onModuleInit();
		await new Promise<void>((resolve: () => void): void => {
			setImmediate(resolve);
		});

		process.off("unhandledRejection", unhandled);
		expect(unhandled).not.toHaveBeenCalled();
	});
});
