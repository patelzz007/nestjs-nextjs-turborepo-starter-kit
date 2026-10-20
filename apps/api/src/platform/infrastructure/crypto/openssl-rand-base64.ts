import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";

/** 128 random bytes encoded as a single-line base64 string (`openssl rand -base64 128`). */
export function opensslRandBase64OneLine(): string {
	try {
		return execSync("openssl rand -base64 128", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).replace(/\s+/g, "");
	} catch {
		return randomBytes(128).toString("base64");
	}
}
