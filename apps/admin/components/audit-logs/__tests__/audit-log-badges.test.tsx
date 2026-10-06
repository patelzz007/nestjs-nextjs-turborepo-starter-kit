// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { HttpAuditLogSummary } from "@workspace/shared";
import { afterEach, describe, expect, it } from "vitest";

import { AuditActorCell, AuditAuthMethodBadge, AuditDeviceBadge, AuditIpScopeBadge, AuditMethodBadge, AuditOutcomeBadge, describeClientSoftware } from "../audit-log-badges";

type ActorFields = Pick<HttpAuditLogSummary, "actor" | "impersonator" | "apiKeyId" | "terminalId">;

const NOBODY: ActorFields = { actor: null, impersonator: null, apiKeyId: null, terminalId: null };

afterEach((): void => {
	cleanup();
});

describe("AuditMethodBadge", () => {
	it.each([
		["GET", "blue"],
		["POST", "green"],
		["PUT", "orange"],
		["PATCH", "yellow"],
		["DELETE", "red"],
		["HEAD", "teal"],
		["OPTIONS", "violet"],
	])("colours %s %s", (method, tone) => {
		render(<AuditMethodBadge method={method} />);

		expect(screen.getByText(method).className).toContain(`text-tone-${tone}`);
	});

	it("outlines a method outside the standard set", () => {
		render(<AuditMethodBadge method="PROPFIND" />);

		expect(screen.getByText("PROPFIND").className).not.toContain("text-tone-");
	});
});

describe("chips", () => {
	it("colours the outcome by status class: 2xx green, 3xx teal, 4xx orange, 5xx red", () => {
		render(
			<>
				<AuditOutcomeBadge outcome="SUCCEEDED" status={204} />
				<AuditOutcomeBadge outcome="SUCCEEDED" status={302} />
				<AuditOutcomeBadge outcome="FAILED" status={404} />
				<AuditOutcomeBadge outcome="FAILED" status={503} />
			</>,
		);

		expect(screen.getByText(/Succeeded 204/).className).toContain("text-tone-green");
		expect(screen.getByText(/Succeeded 302/).className).toContain("text-tone-teal");
		expect(screen.getByText(/Failed 404/).className).toContain("text-tone-orange");
		expect(screen.getByText(/Failed 503/).className).toContain("text-tone-red");
	});

	it("labels the credential, the device and the address class", () => {
		render(
			<>
				<AuditAuthMethodBadge authMethod="API_KEY" />
				<AuditAuthMethodBadge authMethod={null} />
				<AuditDeviceBadge deviceType="BOT" />
				<AuditIpScopeBadge scope="SHARED" />
			</>,
		);

		expect(screen.getByText("API key").className).toContain("text-tone-orange");
		expect(screen.getByText("Anonymous")).toBeTruthy();
		expect(screen.getByText("Bot").className).toContain("text-tone-orange");
		expect(screen.getByText("Carrier NAT").className).toContain("text-tone-yellow");
	});
});

describe("describeClientSoftware", () => {
	it("joins the browser's major version and the OS", () => {
		expect(describeClientSoftware({ browserName: "Chrome", browserVersion: "129.0.6668.70", osName: "Android", osVersion: "14" })).toBe("Chrome 129 · Android 14");
	});

	it("shows whichever half it has, and null when it has neither", () => {
		expect(describeClientSoftware({ browserName: "curl", browserVersion: "8.7.1", osName: null, osVersion: null })).toBe("curl 8");
		expect(describeClientSoftware({ browserName: null, browserVersion: null, osName: "iOS", osVersion: null })).toBe("iOS");
		expect(describeClientSoftware({ browserName: null, browserVersion: null, osName: null, osVersion: null })).toBeNull();
	});
});

describe("AuditOutcomeBadge", () => {
	it("shows outcome and status together", () => {
		render(
			<>
				<AuditOutcomeBadge outcome="SUCCEEDED" status={201} />
				<AuditOutcomeBadge outcome="FAILED" status={403} />
			</>,
		);

		expect(screen.getByText(/Succeeded 201/)).toBeTruthy();
		expect(screen.getByText(/Failed 403/)).toBeTruthy();
	});
});

describe("AuditActorCell", () => {
	it("names the user who acted", () => {
		render(<AuditActorCell entry={{ ...NOBODY, actor: { id: "u-1", email: "jane@example.com", fullName: "Jane Doe" } }} />);

		expect(screen.getByText("Jane Doe")).toBeTruthy();
		expect(screen.getByText("jane@example.com")).toBeTruthy();
	});

	it("falls back to the id when the user no longer resolves", () => {
		render(<AuditActorCell entry={{ ...NOBODY, actor: { id: "u-gone", email: null, fullName: null } }} />);

		expect(screen.getByText("u-gone")).toBeTruthy();
	});

	it("names the SuperAdmin really acting behind an impersonation", () => {
		render(
			<AuditActorCell
				entry={{
					...NOBODY,
					actor: { id: "u-1", email: "jane@example.com", fullName: "Jane Doe" },
					impersonator: { id: "sa-1", email: "root@example.com", fullName: "Root Admin" },
				}}
			/>,
		);

		expect(screen.getByText(/Impersonated by Root Admin/)).toBeTruthy();
	});

	it("shows a machine caller by its terminal", () => {
		render(<AuditActorCell entry={{ ...NOBODY, apiKeyId: "key-1", terminalId: "KL-REGISTER-01" }} />);

		expect(screen.getByText("API key")).toBeTruthy();
		expect(screen.getByText("KL-REGISTER-01")).toBeTruthy();
	});

	it("shows an anonymous request as such", () => {
		render(<AuditActorCell entry={NOBODY} />);

		expect(screen.getByText("Anonymous")).toBeTruthy();
	});
});
