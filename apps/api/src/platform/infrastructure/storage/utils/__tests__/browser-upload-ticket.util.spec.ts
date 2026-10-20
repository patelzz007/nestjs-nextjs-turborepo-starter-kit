import { BrowserUploadTicketSchema } from "@workspace/shared";
import { describe, expect, it } from "vitest";

describe("BrowserUploadTicketSchema", () => {
	it("accepts multipart POST tickets for local/S3", () => {
		const parsed = BrowserUploadTicketSchema.parse({
			fileId: "550e8400-e29b-41d4-a716-446655440000",
			objectPath: "staging/products/a.png",
			expiresIn: 300,
			method: "POST_MULTIPART",
			uploadUrl: "http://localhost:3001/api/v1/files/550e8400-e29b-41d4-a716-446655440000/local-upload",
			fields: { key: "staging/products/a.png" },
		});
		expect(parsed.method).toBe("POST_MULTIPART");
		expect(parsed.fields?.key).toBe("staging/products/a.png");
	});

	it("accepts signed PUT tickets for Firebase", () => {
		const parsed = BrowserUploadTicketSchema.parse({
			fileId: "550e8400-e29b-41d4-a716-446655440000",
			objectPath: "staging/products/a.png",
			expiresIn: 300,
			method: "PUT",
			uploadUrl: "https://storage.googleapis.com/bucket/object?X-Goog-Signature=abc",
			headers: { "Content-Type": "image/png" },
		});
		expect(parsed.method).toBe("PUT");
		expect(parsed.headers?.["Content-Type"]).toBe("image/png");
	});
});
