import { describe, expect, it } from "vitest";

import { planLocalPublicPathRepairs, toStoredLocalPublicPath } from "./local-public-paths";

const FILE_ID = "4e5f6a7b-8c9d-4e0f-9a1b-2c3d4e5f6a7b";

describe("toStoredLocalPublicPath", () => {
	it("strips the saved address from a local-driver public link, for the file and a rendition", () => {
		expect(toStoredLocalPublicPath(`http://0.0.0.0:8080/api/v1/files/${FILE_ID}/local-public`)).toBe(`/api/v1/files/${FILE_ID}/local-public`);
		expect(toStoredLocalPublicPath(`http://192.168.1.23:8080/api/v1/files/${FILE_ID}/variants/THUMBNAIL/local-public`)).toBe(
			`/api/v1/files/${FILE_ID}/variants/THUMBNAIL/local-public`,
		);
	});

	it("leaves a CDN or bucket URL, an already-repaired path and no link alone", () => {
		expect(toStoredLocalPublicPath("https://cdn.example.com/stores/logo.webp")).toBeNull();
		expect(toStoredLocalPublicPath(`/api/v1/files/${FILE_ID}/local-public`)).toBeNull();
		expect(toStoredLocalPublicPath(null)).toBeNull();
	});
});

describe("planLocalPublicPathRepairs", () => {
	it("plans only the rows that need it", () => {
		expect(
			planLocalPublicPathRepairs([
				{ id: "a", publicPath: `http://0.0.0.0:8080/api/v1/files/${FILE_ID}/local-public` },
				{ id: "b", publicPath: `/api/v1/files/${FILE_ID}/local-public` },
				{ id: "c", publicPath: null },
			]),
		).toEqual([{ id: "a", from: `http://0.0.0.0:8080/api/v1/files/${FILE_ID}/local-public`, to: `/api/v1/files/${FILE_ID}/local-public` }]);
	});
});
