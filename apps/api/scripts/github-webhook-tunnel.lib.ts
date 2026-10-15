// Pure helpers of `github-webhook-tunnel.ts` (tested in its spec).

import { z } from "zod";

/** Where the receiver lives under the API's public address. */
export const GITHUB_WEBHOOK_PATH = "/api/v1/github/webhook";

const QuickTunnelUrlSchema = z.url({ protocol: /^https$/u, hostname: /^[a-z0-9-]+\.trycloudflare\.com$/u });

/** The webhook address for a quick tunnel's URL — refused unless it is one (`https://<name>.trycloudflare.com`). */
export function webhookUrlFor(tunnelUrl: string): string {
	const url = QuickTunnelUrlSchema.parse(tunnelUrl.replace(/\/+$/u, ""));
	return `${url}${GITHUB_WEBHOOK_PATH}`;
}

const KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/u;

/**
 * `envText` with `KEY=value` set: an existing line (set or commented out, the
 * first one) is replaced in place, so the file keeps its order and comments;
 * otherwise the line is appended. Values here never need quoting (URLs, hex).
 */
export function withEnvValue(envText: string, key: string, value: string): string {
	if (!KEY_PATTERN.test(key)) {
		throw new Error(`Not an environment variable name: ${key}`);
	}
	const line = `${key}=${value}`;
	const lines = envText.split("\n");
	const index = lines.findIndex((existing: string): boolean => new RegExp(`^\\s*#?\\s*${key}=`, "u").test(existing));
	if (index === -1) {
		const body = envText.endsWith("\n") || envText.length === 0 ? envText : `${envText}\n`;
		return `${body}${line}\n`;
	}
	return lines.map((existing: string, position: number): string => (position === index ? line : existing)).join("\n");
}

/** The value of an uncommented `KEY=value` line, or `null`. */
export function envValue(envText: string, key: string): string | null {
	for (const line of envText.split("\n")) {
		const trimmed = line.trim();
		if (trimmed.startsWith(`${key}=`)) {
			return trimmed.slice(key.length + 1).trim();
		}
	}
	return null;
}
