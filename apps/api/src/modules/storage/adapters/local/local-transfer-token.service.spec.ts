import { describe, expect, it } from "vitest";

import { LocalTransferTokenError, LocalTransferTokenService } from "./local-transfer-token.service";

const FILE_ID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_FILE_ID = "6ba7b810-9dad-41d1-80b4-00c04fd430c8";
const START = 1_700_000_000_000;
const TTL_SECONDS = 60;
const MS_PER_SECOND = 1_000;
const CHECKSUM = "a".repeat(64);

const DOWNLOAD = { fileId: FILE_ID, container: "local-private-bucket", path: "kyb/org/doc.pdf", disposition: null, fileName: null };
const UPLOAD = {
	fileId: FILE_ID,
	container: "local-private-bucket",
	path: "staging/kyb/org/doc.pdf",
	maxBytes: 1_024,
	mimeType: "application/pdf",
	checksumSha256: CHECKSUM,
} satisfies Parameters<LocalTransferTokenService["signUpload"]>[0];

function clockAt(start: number): { readonly now: () => number; advance: (ms: number) => void } {
	let current = start;
	return {
		now: (): number => current,
		advance: (ms: number): void => {
			current += ms;
		},
	};
}

function rejectionOf(action: () => void): string | null {
	try {
		action();
		return null;
	} catch (error) {
		return error instanceof LocalTransferTokenError ? error.reason : "UNEXPECTED";
	}
}

describe("LocalTransferTokenService", () => {
	it("round-trips a download token bound to file, container and path", () => {
		const service = new LocalTransferTokenService(clockAt(START).now);

		expect(service.verifyDownload(service.signDownload(DOWNLOAD, TTL_SECONDS))).toEqual({
			...DOWNLOAD,
			operation: "download",
			expiresAt: START + TTL_SECONDS * MS_PER_SECOND,
		});
	});

	it("rejects an expired token", () => {
		const clock = clockAt(START);
		const service = new LocalTransferTokenService(clock.now);
		const token = service.signDownload(DOWNLOAD, TTL_SECONDS);

		clock.advance(TTL_SECONDS * MS_PER_SECOND);

		expect(rejectionOf(() => service.verifyDownload(token))).toBe("EXPIRED");
	});

	it("rejects a forged token whose payload was rewritten to another path or file", () => {
		const service = new LocalTransferTokenService(clockAt(START).now);
		const [, signature] = service.signDownload(DOWNLOAD, TTL_SECONDS).split(".");
		const forgedPayload = Buffer.from(
			JSON.stringify({ ...DOWNLOAD, fileId: OTHER_FILE_ID, path: "../../.env", operation: "download", expiresAt: START + TTL_SECONDS * MS_PER_SECOND }),
		).toString("base64url");

		expect(rejectionOf(() => service.verifyDownload(`${forgedPayload}.${signature ?? ""}`))).toBe("BAD_SIGNATURE");
	});

	it("rejects a token signed by another process (different key)", () => {
		const token = new LocalTransferTokenService(clockAt(START).now).signDownload(DOWNLOAD, TTL_SECONDS);

		expect(rejectionOf(() => new LocalTransferTokenService(clockAt(START).now).verifyDownload(token))).toBe("BAD_SIGNATURE");
	});

	it("never accepts a download token as an upload token (or the reverse)", () => {
		const service = new LocalTransferTokenService(clockAt(START).now);

		expect(rejectionOf(() => service.verifyUpload(service.signDownload(DOWNLOAD, TTL_SECONDS)))).toBe("WRONG_OPERATION");
		expect(rejectionOf(() => service.verifyDownload(service.signUpload(UPLOAD, TTL_SECONDS)))).toBe("WRONG_OPERATION");
	});

	it.each(["", "abc", "a.b.c", ".sig", "not-base64.@@@"])("rejects the malformed token %j", (token: string) => {
		const service = new LocalTransferTokenService(clockAt(START).now);

		expect(rejectionOf(() => service.verifyUpload(token))).not.toBeNull();
	});
});
