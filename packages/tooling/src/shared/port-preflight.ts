/**
 * Port preflight for jobs that start their own servers (`pnpm ci:local`'s
 * browser job). If something already listens on a port the job needs — usually
 * a developer's `pnpm dev` — the job's server cannot bind, and its readiness
 * wait would succeed against the OTHER process, so the suites would silently
 * test the wrong server. The preflight turns that into an explicit failure.
 * The probe is injected so the logic is unit-tested.
 */
import net from "node:net";

/** Loopback hosts a local server may bind: IPv4 (e.g. the API on 127.0.0.1) and IPv6 (Next.js on `::`). */
export const LOOPBACK_HOSTS = ["127.0.0.1", "::1"];
/** A loopback connect answers at once; anything slower counts as "nothing listening". */
export const PORT_PROBE_TIMEOUT_MS = 500;

/** Whether anything accepts a TCP connection on `host:port`. */

export function acceptsConnections(host: string, port: number, timeoutMs: number = PORT_PROBE_TIMEOUT_MS): Promise<boolean> {
	return new Promise((resolve) => {
		const socket = net.connect({ host, port });
		const settle = (inUse: boolean): void => {
			socket.destroy();
			resolve(inUse);
		};
		socket.setTimeout(timeoutMs, () => {
			settle(false);
		});
		socket.once("connect", () => {
			settle(true);
		});
		socket.once("error", () => {
			settle(false);
		});
	});
}

export async function isPortInUse(port: number, probe: (host: string, port: number) => Promise<boolean> = acceptsConnections): Promise<boolean> {
	const answers = await Promise.all(LOOPBACK_HOSTS.map((host) => probe(host, port)));
	return answers.some(Boolean);
}

/** The servers whose port is already taken. */

export async function findOccupiedPorts<Server extends { id: string; port: number }>(
	servers: readonly Server[],
	inUse: (port: number) => Promise<boolean> = isPortInUse,
): Promise<Server[]> {
	const taken = await Promise.all(servers.map((server) => inUse(server.port)));
	return servers.filter((_, index) => taken[index]);
}

/** The failure note naming each occupied port and what to do about it. */

export function describeOccupiedPorts(occupied: readonly { id: string; port: number }[]): string {
	const list = occupied.map((server) => `${String(server.port)} (${server.id})`).join(", ");
	return `port(s) already in use: ${list} — stop whatever listens there (usually \`pnpm dev\`) and re-run; otherwise the suites would run against that process instead of this build`;
}
