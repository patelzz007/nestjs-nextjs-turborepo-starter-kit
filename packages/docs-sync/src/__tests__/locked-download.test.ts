import { describe, expect, it } from "vitest";

import { AssetRefusedError, downloadImage, MAX_ASSET_BYTES, type DownloadEnvironment } from "../locked-download.ts";

const HOSTS: ReadonlySet<string> = new Set(["files.example"]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const URL_OK = "https://files.example/a.png";

function environment(respond: (url: string) => Response, addresses: readonly string[] = ["93.184.216.34"]): DownloadEnvironment {
	return {
		fetch: (input) => Promise.resolve(respond(String(input))),
		resolveHost: () => Promise.resolve(addresses),
	};
}

function image(bytes: Uint8Array<ArrayBuffer> = PNG, contentType = "image/png"): Response {
	return new Response(bytes, { status: 200, headers: { "content-type": contentType } });
}

describe("downloadImage", () => {
	it("downloads an image from an allowed host", async () => {
		await expect(
			downloadImage(
				URL_OK,
				HOSTS,
				environment(() => image()),
			),
		).resolves.toMatchObject({ extension: "png" });
	});

	it.each([
		["plain HTTP", "http://files.example/a.png", "Only HTTPS"],
		["another host", "https://evil.example/a.png", "own hosts"],
	])("refuses %s", async (_name, address, message) => {
		await expect(
			downloadImage(
				address,
				HOSTS,
				environment(() => image()),
			),
		).rejects.toThrow(message);
	});

	it.each(["127.0.0.1", "10.1.2.3", "172.16.0.9", "192.168.1.1", "169.254.169.254", "::1", "fe80::1", "fc00::1"])("refuses a host resolving to %s (SSRF)", async (address) => {
		await expect(
			downloadImage(
				URL_OK,
				HOSTS,
				environment(() => image(), [address]),
			),
		).rejects.toThrow("private address");
	});

	it("refuses a host that resolves to nothing", async () => {
		await expect(
			downloadImage(
				URL_OK,
				HOSTS,
				environment(() => image(), []),
			),
		).rejects.toBeInstanceOf(AssetRefusedError);
	});

	it("checks every redirect hop", async () => {
		const redirect = (): Response => new Response(null, { status: 302, headers: { location: "https://evil.example/a.png" } });
		await expect(downloadImage(URL_OK, HOSTS, environment(redirect))).rejects.toThrow("own hosts");
	});

	it("follows a redirect that stays on allowed hosts", async () => {
		const respond = (url: string): Response => (url.endsWith("/a.png") ? new Response(null, { status: 302, headers: { location: "/b.png" } }) : image());
		await expect(downloadImage(URL_OK, HOSTS, environment(respond))).resolves.toMatchObject({ extension: "png" });
	});

	it("stops after too many redirects", async () => {
		const redirect = (): Response => new Response(null, { status: 302, headers: { location: "/again.png" } });
		await expect(downloadImage(URL_OK, HOSTS, environment(redirect))).rejects.toThrow("redirected more than");
	});

	it("refuses a redirect with no address", async () => {
		await expect(
			downloadImage(
				URL_OK,
				HOSTS,
				environment(() => new Response(null, { status: 302 })),
			),
		).rejects.toThrow("redirect to nowhere");
	});

	it("refuses a failed response", async () => {
		await expect(
			downloadImage(
				URL_OK,
				HOSTS,
				environment(() => new Response("gone", { status: 404 })),
			),
		).rejects.toThrow("answered 404");
	});

	it("refuses SVG, which can carry script", async () => {
		await expect(
			downloadImage(
				URL_OK,
				HOSTS,
				environment(() => image(new TextEncoder().encode("<svg/>"), "image/svg+xml")),
			),
		).rejects.toThrow("not accepted");
	});

	it("refuses a file whose contents are not what its type says", async () => {
		await expect(
			downloadImage(
				URL_OK,
				HOSTS,
				environment(() => image(new TextEncoder().encode("<html>"))),
			),
		).rejects.toThrow("its contents are not");
	});

	it("refuses a file over the size cap", async () => {
		await expect(
			downloadImage(
				URL_OK,
				HOSTS,
				environment(() => image(new Uint8Array(MAX_ASSET_BYTES + 1))),
			),
		).rejects.toThrow("byte limit");
	});

	it("reads the type with its parameters", async () => {
		await expect(
			downloadImage(
				URL_OK,
				HOSTS,
				environment(() => image(PNG, "IMAGE/PNG; charset=binary")),
			),
		).resolves.toMatchObject({ extension: "png" });
	});
});
