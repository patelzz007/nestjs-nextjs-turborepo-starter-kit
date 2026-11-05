import { describe, expect, it } from "vitest";

import { checkOutboundUrl, isAllowedOutboundAddress, type OutboundRefusalReason } from "../outbound-target-policy";

const STRICT = { allowLoopback: false };
const LOOPBACK_ALLOWED = { allowLoopback: true };

describe("isAllowedOutboundAddress", () => {
	it.each(["8.8.8.8", "1.1.1.1", "93.184.216.34", "2606:4700:4700::1111", "2a00:1450:4001:82a::200e"])("allows the public address %s", (address) => {
		expect(isAllowedOutboundAddress(address, STRICT)).toBe(true);
	});

	it.each([
		["127.0.0.1", "loopback"],
		["127.8.8.8", "loopback"],
		["::1", "IPv6 loopback"],
		["10.1.2.3", "private"],
		["172.16.0.1", "private"],
		["192.168.0.10", "private"],
		["fd00:ec2::254", "unique-local (the AWS IPv6 metadata address)"],
		["169.254.169.254", "link-local (cloud metadata)"],
		["fe80::1", "IPv6 link-local"],
		["100.64.0.1", "carrier-grade NAT"],
		["0.0.0.0", "unspecified"],
		["::", "IPv6 unspecified"],
		["255.255.255.255", "broadcast"],
		["224.0.0.1", "multicast"],
		["ff02::1", "IPv6 multicast"],
		["192.0.2.10", "documentation"],
		["198.18.0.1", "benchmarking"],
		["240.0.0.1", "reserved"],
		["::ffff:127.0.0.1", "IPv4-mapped loopback (dotted)"],
		["::ffff:7f00:1", "IPv4-mapped loopback (hex)"],
		["::ffff:a9fe:a9fe", "IPv4-mapped metadata (hex)"],
		["::ffff:8.8.8.8", "IPv4-mapped, even of a public address (DNS never answers one; a literal is a disguise)"],
		["64:ff9b::a00:1", "NAT64 of a private address"],
		["64:ff9b:1::1", "local-use NAT64"],
		["2002:c0a8:1::1", "6to4 of a private address"],
		["2001:0:4136:e378::1", "Teredo"],
		["fec0::1", "site-local"],
		["::7f00:1", "IPv4-compatible"],
		["not-an-ip", "not an address"],
	])("refuses %s (%s)", (address) => {
		expect(isAllowedOutboundAddress(address, STRICT)).toBe(false);
	});

	it("allows loopback only when the development switch is on", () => {
		expect(isAllowedOutboundAddress("127.0.0.1", LOOPBACK_ALLOWED)).toBe(true);
		expect(isAllowedOutboundAddress("::1", LOOPBACK_ALLOWED)).toBe(true);
		expect(isAllowedOutboundAddress("10.0.0.1", LOOPBACK_ALLOWED)).toBe(false);
		expect(isAllowedOutboundAddress("169.254.169.254", LOOPBACK_ALLOWED)).toBe(false);
	});
});

describe("checkOutboundUrl", () => {
	function refusal(url: string, policy = STRICT): OutboundRefusalReason | null {
		const result = checkOutboundUrl(url, policy);
		return result.ok ? null : result.reason;
	}

	it("accepts an HTTPS URL on a public name or address", () => {
		expect(refusal("https://hooks.example.com/rewards?token=1")).toBeNull();
		expect(refusal("https://hooks.example.com:8443/rewards")).toBeNull();
		expect(refusal("https://93.184.216.34/hook")).toBeNull();
		expect(refusal("https://[2606:4700:4700::1111]/hook")).toBeNull();
	});

	it("refuses anything that is not a URL", () => {
		expect(refusal("hooks.example.com/rewards")).toBe("invalid_url");
		expect(refusal("")).toBe("invalid_url");
	});

	it("refuses every scheme but HTTPS", () => {
		expect(refusal("http://hooks.example.com")).toBe("scheme_not_allowed");
		expect(refusal("ftp://hooks.example.com")).toBe("scheme_not_allowed");
		expect(refusal("file:///etc/passwd")).toBe("scheme_not_allowed");
		expect(refusal("gopher://hooks.example.com")).toBe("scheme_not_allowed");
	});

	it("refuses credentials in the URL", () => {
		expect(refusal("https://user:secret@hooks.example.com")).toBe("credentials_in_url");
		expect(refusal("https://user@hooks.example.com")).toBe("credentials_in_url");
	});

	it("refuses a literal private, loopback or metadata address", () => {
		expect(refusal("https://10.0.0.8/hook")).toBe("address_not_allowed");
		expect(refusal("https://169.254.169.254/latest/meta-data")).toBe("address_not_allowed");
		expect(refusal("https://[::1]/hook")).toBe("address_not_allowed");
		expect(refusal("https://[::ffff:7f00:1]/hook")).toBe("address_not_allowed");
		// WHATWG URL parsing turns these spellings of 127.0.0.1 into the dotted form before the check sees them.
		expect(refusal("https://2130706433/hook")).toBe("address_not_allowed");
		expect(refusal("https://0x7f.1/hook")).toBe("address_not_allowed");
	});

	it("refuses localhost names and single-label hosts", () => {
		expect(refusal("https://localhost/hook")).toBe("host_not_allowed");
		expect(refusal("https://api.localhost/hook")).toBe("host_not_allowed");
		expect(refusal("https://intranet/hook")).toBe("host_not_allowed");
	});

	it("lets loopback through, over HTTP too, only with the development switch", () => {
		expect(refusal("http://localhost:4010/hook", LOOPBACK_ALLOWED)).toBeNull();
		expect(refusal("http://127.0.0.1:4010/hook", LOOPBACK_ALLOWED)).toBeNull();
		expect(refusal("http://[::1]:4010/hook", LOOPBACK_ALLOWED)).toBeNull();
		expect(refusal("http://127.0.0.1:4010/hook")).toBe("scheme_not_allowed");
		// The switch is for loopback only: plain HTTP elsewhere, and private networks, stay refused.
		expect(refusal("http://hooks.example.com", LOOPBACK_ALLOWED)).toBe("scheme_not_allowed");
		expect(refusal("https://192.168.1.5/hook", LOOPBACK_ALLOWED)).toBe("address_not_allowed");
	});
});
