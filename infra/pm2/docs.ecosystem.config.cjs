// pm2's description of the docs site on a Droplet (ADR 084). Shipped inside each docs release as
// ecosystem.config.cjs, so `pm2 startOrReload` starts the process from the release it belongs to. Separate from the
// platform's file: a docs deploy reloads this one process and nothing else.
const { readFileSync } = require("node:fs");
const path = require("node:path");

const { slug } = JSON.parse(readFileSync(path.join(__dirname, "project.json"), "utf8"));

module.exports = {
	apps: [
		{
			name: `${slug}-docs`,
			cwd: path.join(__dirname, "apps/docs"),
			script: "scripts/serve.ts",
			exec_mode: "fork",
			instances: 1,
			env: { NODE_ENV: "production", PORT: "3002", HOST: "127.0.0.1" },
			exp_backoff_restart_delay: 200,
			max_memory_restart: "512M",
			kill_timeout: 15_000,
			time: true,
		},
	],
};
