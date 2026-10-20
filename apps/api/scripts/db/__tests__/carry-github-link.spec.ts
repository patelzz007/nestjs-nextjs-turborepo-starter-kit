import { mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { exportGithubLink, importGithubLink, parseCarryArguments, type CarryIo, type GithubLinkCarryRow, type GithubLinkCarryStore } from "../carry-github-link";

const CIPHERTEXT = "iv:tag:ciphertext-do-not-log";

function row(): GithubLinkCarryRow {
	return {
		id: "0199f0a0-0000-7000-8000-000000000001",
		createdAt: "1790000000000",
		createdBy: "system:seed",
		updatedAt: "1790000000001",
		updatedBy: null,
		isDeleted: false,
		deletedAt: null,
		deletedBy: null,
		githubUserId: "42",
		githubLogin: "octocat",
		tokenCiphertext: CIPHERTEXT,
		tokenKeyVersion: 1,
		tokenExpiresAt: null,
		status: "ACTIVE",
		linkedAt: "1790000000002",
	};
}

function memoryStore(initial: { readonly email: string; readonly link: GithubLinkCarryRow } | null): GithubLinkCarryStore & { readonly upserts: GithubLinkCarryRow[] } {
	const users = new Map<string, string>();
	const upserts: GithubLinkCarryRow[] = [];
	if (initial !== null) {
		users.set(initial.email, "user-1");
	}
	return {
		upserts,
		findSoleSuperadminLink: (): Promise<{ readonly email: string; readonly link: GithubLinkCarryRow } | null> => Promise.resolve(initial),
		findUserIdByEmail: (email: string): Promise<string | null> => Promise.resolve(users.get(email) ?? null),
		upsertLink: (userId: string, link: GithubLinkCarryRow): Promise<void> => {
			upserts.push({ ...link, createdBy: userId });
			return Promise.resolve();
		},
	};
}

function memoryIo(): CarryIo & { readonly files: Map<string, string> } {
	const files = new Map<string, string>();
	return {
		files,
		read: (path: string): string => {
			const contents = files.get(path);
			if (contents === undefined) {
				throw new Error(`missing ${path}`);
			}
			return contents;
		},
		write: (path: string, contents: string): void => {
			files.set(path, contents);
		},
	};
}

describe("carry-github-link", () => {
	it("round-trips the ciphertext without putting it in the result text", async () => {
		const source = memoryStore({ email: "admin@example.com", link: row() });
		const io = memoryIo();
		const exported = await exportGithubLink(source, "/tmp/link.json", io);
		expect(exported.kind).toBe("exported");
		expect(JSON.stringify(exported)).not.toContain(CIPHERTEXT);

		const destination = memoryStore(null);
		destination.findUserIdByEmail = (email: string): Promise<string | null> => Promise.resolve(email === "admin@example.com" ? "user-2" : null);
		const imported = await importGithubLink(destination, "/tmp/link.json", io);
		expect(imported).toEqual({ kind: "imported", email: "admin@example.com" });
		const [written] = destination.upserts;
		expect(written?.tokenCiphertext).toBe(CIPHERTEXT);
		expect(JSON.stringify(imported)).not.toContain(CIPHERTEXT);
	});

	it("stops when the email matches no user and writes nothing", async () => {
		const io = memoryIo();
		io.write("/tmp/link.json", `${JSON.stringify({ email: "missing@example.com", link: row() })}\n`);
		const store = memoryStore(null);
		const result = await importGithubLink(store, "/tmp/link.json", io);
		expect(result).toEqual({ kind: "missing_user", email: "missing@example.com" });
		expect(store.upserts).toEqual([]);
	});

	it("accepts the pnpm argument separator before export", () => {
		const command = parseCarryArguments(["--", "export", "--out", "/tmp/link.json"]);
		expect(command).toEqual({ kind: "export", out: "/tmp/link.json" });
	});

	it("writes the carry file so only the owner can read it", async () => {
		const directory = mkdtempSync(join(tmpdir(), "github-link-"));
		const path = join(directory, "github-link.json");
		const source = memoryStore({ email: "admin@example.com", link: row() });
		await exportGithubLink(source, path);
		expect(statSync(path).mode & 0o777).toBe(0o600);
	});
});
