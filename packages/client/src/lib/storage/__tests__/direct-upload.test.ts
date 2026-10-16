import { LIST_SLOT_INDEX, type CreateFileUploadUrlResponse } from "@workspace/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FetchImpl } from "../../test-utils";
import { DirectUploadError, uploadFileWithTicket } from "../direct-upload";

const FILE_ID = "4d9a3f5e-2f6b-4c55-8f0c-9a4b1c2d3e4f";

function postTicket(): CreateFileUploadUrlResponse {
	return {
		fileId: FILE_ID,
		objectPath: "tmp/kyb/doc.pdf",
		expiresIn: 300,
		method: "POST_MULTIPART",
		uploadUrl: "http://storage.test/upload",
		fields: { key: "tmp/kyb/doc.pdf", token: "signed-token" },
	};
}

function pdf(): File {
	return new File(["%PDF-1.7"], "doc.pdf", { type: "application/pdf" });
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe("uploadFileWithTicket", () => {
	it("sends the ticket's fields in the API's order (key, token) and the file LAST", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(new Response(null, { status: 204 }));
		vi.stubGlobal("fetch", fetchMock);

		await uploadFileWithTicket(postTicket(), pdf());

		const body = fetchMock.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.second]?.body;
		expect(body instanceof FormData ? [...body.keys()] : []).toEqual(["key", "token", "file"]);
	});

	it("treats an unreadable answer (CORS block / network failure) as a FAILED upload — never as success", async () => {
		vi.stubGlobal("fetch", vi.fn<FetchImpl>().mockRejectedValue(new TypeError("Failed to fetch")));

		const upload = uploadFileWithTicket(postTicket(), pdf());

		await expect(upload).rejects.toBeInstanceOf(DirectUploadError);
		await expect(upload).rejects.toMatchObject({ kind: "unreachable" });
	});

	it("reports a storage rejection with its status", async () => {
		vi.stubGlobal("fetch", vi.fn<FetchImpl>().mockResolvedValue(new Response("policy expired", { status: 403 })));

		await expect(uploadFileWithTicket(postTicket(), pdf())).rejects.toMatchObject({ kind: "rejected", status: 403 });
	});

	it("PUTs the bytes with the signed headers for a PUT ticket", async () => {
		const fetchMock = vi.fn<FetchImpl>().mockResolvedValue(new Response(null, { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);

		await uploadFileWithTicket({ ...postTicket(), method: "PUT", fields: undefined, headers: { "Content-Type": "application/pdf" } }, pdf());

		expect(fetchMock.mock.calls[LIST_SLOT_INDEX.first]?.[LIST_SLOT_INDEX.second]).toMatchObject({ method: "PUT", headers: { "Content-Type": "application/pdf" } });
	});
});
