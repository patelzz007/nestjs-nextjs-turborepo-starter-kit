import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text } from "react-native";

import { PERMISSION, type CapabilitySlug } from "@workspace/shared";
import { fail, ok, stubApi } from "../../../../test/api-stub";
import { AppProviders, createTestRuntime } from "../../../../test/app-harness";
import { sessionPermissionsJson } from "../../../../test/fixtures";
import { testAccessToken } from "../../../../test/jwt";
import { Can, CapabilitiesProvider, SessionCapabilitiesProvider, useAuthorization, useCapabilities } from "../facade";

const SERVERS = PERMISSION.SERVER_METRIC.LIST;
const GITHUB_READ = PERMISSION.GITHUB_PULL_REQUEST.READ;

function Probe(): React.JSX.Element {
	const auth = useAuthorization();
	const capabilities = useCapabilities();
	return <Text>{`${auth.can(SERVERS) ? "may" : "may not"} list servers · ${String(capabilities.length)} held`}</Text>;
}

async function renderWith(capabilities: readonly CapabilitySlug[], element: React.JSX.Element): Promise<void> {
	await render(<CapabilitiesProvider capabilities={capabilities}>{element}</CapabilitiesProvider>);
}

describe("Can", () => {
	it("shows its children when the session holds the capability", async () => {
		await renderWith(
			[SERVERS],
			<Can permission={SERVERS}>
				<Text>servers</Text>
			</Can>,
		);

		expect(screen.getByText("servers")).toBeOnTheScreen();
	});

	it("shows the fallback, or nothing, when it does not", async () => {
		await renderWith(
			[],
			<>
				<Can permission={SERVERS} fallback={<Text>no access</Text>}>
					<Text>servers</Text>
				</Can>
				<Can permission={SERVERS}>
					<Text>hidden</Text>
				</Can>
			</>,
		);

		expect(screen.getByText("no access")).toBeOnTheScreen();
		expect(screen.queryByText("servers")).toBeNull();
		expect(screen.queryByText("hidden")).toBeNull();
	});

	it("checks several capabilities under their mode", async () => {
		await renderWith(
			[GITHUB_READ],
			<>
				<Can permissions={[GITHUB_READ, SERVERS]}>
					<Text>any</Text>
				</Can>
				<Can permissions={[GITHUB_READ, SERVERS]} mode="all">
					<Text>all</Text>
				</Can>
			</>,
		);

		expect(screen.getByText("any")).toBeOnTheScreen();
		expect(screen.queryByText("all")).toBeNull();
	});

	it("denies everything outside a provider (fail closed)", async () => {
		await render(<Probe />);

		expect(screen.getByText("may not list servers · 0 held")).toBeOnTheScreen();
	});
});

describe("SessionCapabilitiesProvider", () => {
	async function renderSession(): Promise<void> {
		const runtime = createTestRuntime({}, { status: "signedIn", session: { scope: "full" } });
		await runtime.tokenProvider.saveTokens({ accessToken: testAccessToken(), refreshToken: "refresh-1" });
		await render(
			<AppProviders runtime={runtime}>
				<SessionCapabilitiesProvider>
					<Probe />
				</SessionCapabilitiesProvider>
			</AppProviders>,
		);
	}

	it("grants what GET /auth/permissions lists, nothing before it answers", async () => {
		stubApi({ "GET /auth/permissions": ok(sessionPermissionsJson([SERVERS])) });
		await renderSession();

		expect(await screen.findByText("may list servers · 1 held")).toBeOnTheScreen();
	});

	it("grants nothing when the capabilities cannot be read", async () => {
		stubApi({ "GET /auth/permissions": fail(500, "INTERNAL", "Down") });
		await renderSession();

		expect(await screen.findByText("may not list servers · 0 held")).toBeOnTheScreen();
	});
});
