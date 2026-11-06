/**
 * The pieces of `src/playwright-in-docker/cli.ts` (enhancement 3.8): a Playwright suite run inside Playwright's own Linux
 * image, so screenshots taken on a Mac match the ones CI (Linux) takes. The repository is mounted at the same path,
 * so its node_modules links resolve. Inside the container, `localhost:<port>` is forwarded to this machine
 * (`src/playwright-in-docker/docker-forward-and-run.ts`): the browser sees the apps at the very origins it would outside, which the API's
 * CORS list and the session cookies expect. Pure, so unit-tested.
 */

import { z } from "zod";

/** The image tag is the installed @playwright/test's version: its browsers are the ones that version drives. */
/** One forwarded port: the container's localhost port and the host port it reaches. */
export interface PortForward {
	readonly containerPort: number;
	readonly hostPort: number;
}

/** What `docker run` needs for one suite. */
export interface DockerRunOptions {
	readonly image: string;
	readonly repoRoot: string;
	readonly workdir: string;
	readonly uid: number;
	readonly gid: number;
	readonly env: readonly (readonly [string, string])[];
	readonly command: readonly string[];
}

export function playwrightImage(version: string): string {
	return `mcr.microsoft.com/playwright:v${z
		.string()
		.regex(/^\d+\.\d+\.\d+$/u)
		.parse(version)}-noble`;
}

/** The name a container uses for the machine running Docker. */
export const DOCKER_HOST_NAME = "host.docker.internal";

const PortSchema = z.coerce.number().int().min(1).max(65_535);
const FORWARD_PATTERN = /^(?<container>\d+)(?::(?<host>\d+))?$/u;

/**
 * `--forward <port>` or `--forward <container port>:<host port>` from the arguments (repeatable; a later one for the
 * same container port wins), and the arguments left for Playwright.
 */
export function parseForwards(argv: readonly string[]): { forwards: { containerPort: number; hostPort: number }[]; rest: string[] } {
	const forwards = new Map<number, number>();
	const rest: string[] = [];
	for (let index = 0; index < argv.length; index += 1) {
		const argument = argv.at(index) ?? "";
		if (argument !== "--forward") {
			rest.push(argument);
			continue;
		}
		index += 1;
		const groups = FORWARD_PATTERN.exec(argv.at(index) ?? "")?.groups;
		if (groups === undefined) {
			throw new Error(`--forward needs <port> or <container port>:<host port>, got "${argv.at(index) ?? ""}"`);
		}
		const containerPort = PortSchema.parse(groups.container);
		forwards.set(containerPort, PortSchema.parse(groups.host ?? groups.container));
	}
	return { forwards: [...forwards].map(([containerPort, hostPort]) => ({ containerPort, hostPort })), rest };
}

/** The forwards as one argument for `src/playwright-in-docker/docker-forward-and-run.ts`: `3001:3101,8080:8080`. */
export function forwardsArgument(forwards: readonly PortForward[]): string {
	return forwards.map(({ containerPort, hostPort }) => `${String(containerPort)}:${String(hostPort)}`).join(",");
}

/** The suite's variables to pass into the container: every `<PREFIX>*` one that is set. */
export function containerEnv(environment: NodeJS.ProcessEnv, prefix: string): [string, string][] {
	return Object.entries(environment).flatMap(([name, value]): [string, string][] => (name.startsWith(prefix) && value !== undefined ? [[name, value]] : []));
}

/**
 * `docker run`'s arguments: the image, the repository at the same path, the workspace as the working
 * directory, the user's own ids (files it writes stay theirs), the suite's variables, then the command.
 */
export function dockerRunArgs({ image, repoRoot, workdir, uid, gid, env, command }: DockerRunOptions): string[] {
	return [
		"run",
		"--rm",
		"--init",
		"--ipc=host",
		"--add-host",
		`${DOCKER_HOST_NAME}:host-gateway`,
		"--user",
		`${String(uid)}:${String(gid)}`,
		"--env",
		"HOME=/tmp",
		"--env",
		"CI=true",
		...env.flatMap(([name, value]) => ["--env", `${name}=${value}`]),
		"--volume",
		`${repoRoot}:${repoRoot}`,
		"--workdir",
		workdir,
		image,
		...command,
	];
}

/** `src/playwright-in-docker/docker-forward-and-run.ts`'s first argument, read back inside the container. */
export function forwardsOf(argument: string): { containerPort: number; hostPort: number }[] {
	return argument
		.split(",")
		.filter((pair) => pair.length > 0)
		.map((pair) => {
			const [containerPort, hostPort] = pair.split(":");
			return { containerPort: PortSchema.parse(containerPort), hostPort: PortSchema.parse(hostPort) };
		});
}
