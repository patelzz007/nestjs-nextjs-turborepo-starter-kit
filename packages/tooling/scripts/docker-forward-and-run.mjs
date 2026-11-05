#!/usr/bin/env node
// Inside a container (enhancement 3.8, playwright-in-docker.mjs): `node docker-forward-and-run.mjs 3001:3101,8080:8080
// <command…>` listens on localhost at each container port, forwards every connection to the same machine's
// host port (host.docker.internal), runs the command once the listeners are up, and exits with its code. Only Node's
// own modules: it runs in Playwright's image as it is.

import { spawn } from "node:child_process";
import net from "node:net";

import { DOCKER_HOST_NAME, forwardsOf } from "./lib/playwright-in-docker.mjs";

const [forwardsArgumentValue = "", command, ...commandArgs] = process.argv.slice(2);
if (command === undefined) {
	process.stderr.write("Usage: docker-forward-and-run.mjs <container:host,…> <command> [args…]\n");
	process.exit(1);
}

function listen({ containerPort, hostPort }) {
	const server = net.createServer((client) => {
		const upstream = net.connect(hostPort, DOCKER_HOST_NAME);
		client.pipe(upstream).pipe(client);
		const close = () => {
			client.destroy();
			upstream.destroy();
		};
		client.on("error", close);
		upstream.on("error", close);
	});
	return new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(containerPort, "127.0.0.1", () => resolve(server));
	});
}

const servers = await Promise.all(forwardsOf(forwardsArgumentValue).map(listen));
const child = spawn(command, commandArgs, { stdio: "inherit" });
child.on("exit", (code) => {
	for (const server of servers) {
		server.close();
	}
	// A child ended by a signal has no exit code: that is a failure.
	process.exit(code ?? 1);
});
