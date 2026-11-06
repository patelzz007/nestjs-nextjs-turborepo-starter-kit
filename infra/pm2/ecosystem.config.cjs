// pm2's description of the platform's processes on a Droplet (ADR 075). The deploy runs
// `pm2 startOrReload <release>/deploy/pm2/ecosystem.config.cjs`, so each process starts in the release
// this file belongs to. Names are `<slug>-<app>` from project.json, so two products can share a server.
// Each app reads its own apps/<app>/.env, a link to /srv/<slug>/shared/env/<app>.env.
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");

const release = path.resolve(__dirname, "../..");
// releases/<sha> → the deploy root (/srv/<slug>), where shared files live.
const deployRoot = path.resolve(release, "../..");
// The CA that signed the Docker Redis's TLS certificate (guide, step 8). Node reads NODE_EXTRA_CA_CERTS only
// at start-up, so it is set here rather than in the API's .env.
const redisCa = path.join(deployRoot, "shared/tls/ca.crt");
const { slug } = JSON.parse(readFileSync(path.join(release, "project.json"), "utf8"));

/** @param {string} app @param {string} script @param {string[]} args */
function app(app, script, args) {
	return {
		name: `${slug}-${app}`,
		cwd: path.join(release, "apps", app),
		script,
		args,
		exec_mode: "fork",
		instances: 1,
		env: app === "api" && existsSync(redisCa) ? { NODE_ENV: "production", NODE_EXTRA_CA_CERTS: redisCa } : { NODE_ENV: "production" },
		// A crash loop backs off instead of spinning; a leak restarts the process before the Droplet swaps.
		exp_backoff_restart_delay: 200,
		max_memory_restart: app === "api" ? "1G" : "768M",
		kill_timeout: 15_000,
		time: true,
	};
}

const nextBin = (name) => path.join(release, "apps", name, "node_modules/next/dist/bin/next");

module.exports = {
	apps: [
		// The API drains in-flight requests and jobs on SIGTERM within kill_timeout.
		app("api", "dist/main.js", []),
		app("web", nextBin("web"), ["start", "--port", "3000", "--hostname", "127.0.0.1"]),
		app("admin", nextBin("admin"), ["start", "--port", "3001", "--hostname", "127.0.0.1"]),
		app("merchant", nextBin("merchant"), ["start", "--port", "3003", "--hostname", "127.0.0.1"]),
	],
};
