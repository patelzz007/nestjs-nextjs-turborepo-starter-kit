import type { NetworkInterfaceInfo } from "node:os";

import { describe, expect, it } from "vitest";

import { findLanAddress, resolveApiPublicUrl, type NetworkInterfaceMap } from "./api-public-url";

function ipv4(address: string, internal = false): NetworkInterfaceInfo {
	return { address, netmask: "255.255.255.0", family: "IPv4", mac: "00:00:00:00:00:00", internal, cidr: `${address}/24` };
}

const MACBOOK_ON_WIFI: NetworkInterfaceMap = {
	lo0: [ipv4("127.0.0.1", true)],
	bridge100: [ipv4("192.168.64.1")],
	en0: [ipv4("192.168.1.23")],
	utun4: [ipv4("100.96.0.7")],
};

describe("findLanAddress", () => {
	it("picks the Wi-Fi / Ethernet address over a virtual bridge, a VPN and the loopback", () => {
		expect(findLanAddress(MACBOOK_ON_WIFI)).toBe("192.168.1.23");
	});

	it("falls back to any private address, and to none at all", () => {
		expect(findLanAddress({ lo: [ipv4("127.0.0.1", true)], docker0: [ipv4("172.17.0.1")] })).toBe("172.17.0.1");
		expect(findLanAddress({ lo: [ipv4("127.0.0.1", true)], utun0: [ipv4("100.96.0.7")] })).toBeNull();
	});
});

describe("resolveApiPublicUrl", () => {
	it("uses API_PUBLIC_URL when set, without a trailing slash", () => {
		expect(resolveApiPublicUrl({ configuredUrl: "https://api.example.com/", host: "0.0.0.0", port: 8080, isDevelopment: true }, MACBOOK_ON_WIFI)).toBe(
			"https://api.example.com",
		);
	});

	it("uses HOST when it is a real address", () => {
		expect(resolveApiPublicUrl({ host: "127.0.0.1", port: 8080, isDevelopment: true }, MACBOOK_ON_WIFI)).toBe("http://127.0.0.1:8080");
	});

	it("never hands out the listen wildcard: in development it is this machine's LAN address, which a phone can reach", () => {
		expect(resolveApiPublicUrl({ host: "0.0.0.0", port: 8080, isDevelopment: true }, MACBOOK_ON_WIFI)).toBe("http://192.168.1.23:8080");
		expect(resolveApiPublicUrl({ host: "::", port: 8080, isDevelopment: true }, MACBOOK_ON_WIFI)).toBe("http://192.168.1.23:8080");
	});

	it("falls back to localhost for a wildcard without a LAN address, or outside development", () => {
		expect(resolveApiPublicUrl({ host: "0.0.0.0", port: 8080, isDevelopment: true }, {})).toBe("http://localhost:8080");
		expect(resolveApiPublicUrl({ host: "0.0.0.0", port: 8080, isDevelopment: false }, MACBOOK_ON_WIFI)).toBe("http://localhost:8080");
	});
});
