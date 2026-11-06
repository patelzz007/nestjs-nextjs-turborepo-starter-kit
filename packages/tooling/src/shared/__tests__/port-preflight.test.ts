import net from "node:net";

import { z } from "zod";
import { afterEach, describe, expect, it } from "vitest";

import { acceptsConnections, describeOccupiedPorts, findOccupiedPorts, isPortInUse, LOOPBACK_HOSTS } from "../port-preflight.ts";

const SERVERS = [
	{ id: "browser:api", port: 8080 },
	{ id: "browser:web", port: 3000 },
	{ id: "browser:admin", port: 3001 },
];

describe("isPortInUse", () => {
	it("probes every loopback host and reports a port taken on any of them", async () => {
		const probed: string[] = [];
		const inUse = await isPortInUse(3001, (host, port) => {
			probed.push(`${host}:${String(port)}`);
			return Promise.resolve(host === "::1");
		});
		expect(inUse).toBe(true);
		expect(probed).toEqual(LOOPBACK_HOSTS.map((host) => `${host}:3001`));
	});

	it("reports a free port when no host accepts a connection", async () => {
		await expect(isPortInUse(3001, () => Promise.resolve(false))).resolves.toBe(false);
	});
});

describe("findOccupiedPorts", () => {
	it("returns exactly the servers whose port is taken, in order", async () => {
		const taken = new Set([8080, 3001]);
		await expect(findOccupiedPorts(SERVERS, (port) => Promise.resolve(taken.has(port)))).resolves.toEqual(SERVERS.filter((server) => taken.has(server.port)));
	});

	it("returns nothing when every port is free", async () => {
		await expect(findOccupiedPorts(SERVERS, () => Promise.resolve(false))).resolves.toEqual([]);
	});
});

describe("describeOccupiedPorts", () => {
	it("names each port with its server and says what to do", () => {
		const [api, , admin] = SERVERS;
		const note = describeOccupiedPorts([api, admin].flatMap((server) => (server === undefined ? [] : [server])));
		expect(note).toContain("8080 (browser:api), 3001 (browser:admin)");
		expect(note).toContain("pnpm dev");
	});
});

describe("acceptsConnections (real sockets)", () => {
	const servers: net.Server[] = [];

	afterEach(async () => {
		await Promise.all(
			servers.splice(0).map(
				(server) =>
					new Promise<void>((resolve) =>
						server.close(() => {
							resolve();
						}),
					),
			),
		);
	});

	it("is true while a server listens and false once it is closed", async () => {
		const server = net.createServer();
		servers.push(server);
		await new Promise<void>((resolve) =>
			server.listen(0, "127.0.0.1", () => {
				resolve();
			}),
		);
		const { port } = z.object({ port: z.number() }).parse(server.address());

		await expect(acceptsConnections("127.0.0.1", port)).resolves.toBe(true);
		await new Promise<void>((resolve) =>
			server.close(() => {
				resolve();
			}),
		);
		servers.length = 0;
		await expect(acceptsConnections("127.0.0.1", port)).resolves.toBe(false);
	});
});
