import type { IpAddressScope } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { classifyIpAddress } from "./ip-classification";

describe("classifyIpAddress", () => {
	it.each<[string, 4 | 6, IpAddressScope]>([
		["8.8.8.8", 4, "PUBLIC"],
		["1.1.1.1", 4, "PUBLIC"],
		["2606:4700:4700::1111", 6, "PUBLIC"],
		["10.0.0.5", 4, "PRIVATE"],
		["172.16.4.2", 4, "PRIVATE"],
		["172.31.255.255", 4, "PRIVATE"],
		["192.168.1.10", 4, "PRIVATE"],
		["fd12:3456::1", 6, "PRIVATE"],
		["127.0.0.1", 4, "LOOPBACK"],
		["::1", 6, "LOOPBACK"],
		["169.254.10.20", 4, "LINK_LOCAL"],
		["fe80::1", 6, "LINK_LOCAL"],
		["100.64.0.1", 4, "SHARED"],
		["203.0.113.24", 4, "DOCUMENTATION"],
		["198.51.100.7", 4, "DOCUMENTATION"],
		["2001:db8::24", 6, "DOCUMENTATION"],
		["224.0.0.251", 4, "MULTICAST"],
		["ff02::1", 6, "MULTICAST"],
		["0.0.0.0", 4, "RESERVED"],
		["255.255.255.255", 4, "RESERVED"],
		["::", 6, "RESERVED"],
	])("%s is IPv%i %s", (address, version, scope) => {
		expect(classifyIpAddress(address)).toEqual({ version, scope });
	});

	it("classifies an IPv4-mapped IPv6 socket address as the IPv4 address it carries", () => {
		expect(classifyIpAddress("::ffff:192.168.0.9")).toEqual({ version: 4, scope: "PRIVATE" });
	});

	it("ignores an IPv6 zone index", () => {
		expect(classifyIpAddress("fe80::1%eth0")).toEqual({ version: 6, scope: "LINK_LOCAL" });
	});

	it("keeps the edges of a range exact (172.15.x and 172.32.x are public)", () => {
		expect(classifyIpAddress("172.15.255.255")?.scope).toBe("PUBLIC");
		expect(classifyIpAddress("172.32.0.0")?.scope).toBe("PUBLIC");
	});

	it("returns null for anything that is not an IP address", () => {
		expect(classifyIpAddress("unknown")).toBeNull();
		expect(classifyIpAddress("")).toBeNull();
		expect(classifyIpAddress("999.1.1.1")).toBeNull();
	});
});
