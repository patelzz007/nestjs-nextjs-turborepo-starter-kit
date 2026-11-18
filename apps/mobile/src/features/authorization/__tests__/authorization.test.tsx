import { render, screen } from "@testing-library/react-native";
import * as React from "react";
import { Text } from "react-native";

import { MERCHANT_CAPABILITY, PERMISSION, type CapabilitySlug } from "@workspace/shared";
import { fail, ok, stubApi } from "../../../../test/api-stub";
import { AppProviders, createTestRuntime } from "../../../../test/app-harness";
import { sessionPermissionsJson } from "../../../../test/fixtures";
import { testAccessToken } from "../../../../test/jwt";
import { Can, SessionAbilityProvider, SessionCapabilitiesProvider, useAbility, useCapabilities } from "../facade";

const SERVERS = PERMISSION.SERVER_METRIC.LIST;
const GITHUB_READ = PERMISSION.GITHUB_PULL_REQUEST.READ;

function Probe(): React.JSX.Element {
	const ability = useAbility();
	const capabilities = useCapabilities();
	return <Text>{`${ability.can("LIST", "SERVER_METRIC") ? "may" : "may not"} list servers · ${String(capabilities.length)} held`}</Text>;
}

function HeldCount(): React.JSX.Element {
	return <Text>{`${String(useCapabilities().length)} held`}</Text>;
}

async function renderWith(capabilities: readonly CapabilitySlug[], element: React.JSX.Element): Promise<void> {
	await render(<SessionAbilityProvider capabilities={capabilities}>{element}</SessionAbilityProvider>);
}

describe("Can", () => {
	it("shows its children when the session holds the capability", async () => {
		await renderWith(
			[SERVERS],
			<Can I="LIST" a="SERVER_METRIC">
				<Text>servers</Text>
			</Can>,
		);

		expect(screen.getByText("servers")).toBeOnTheScreen();
	});

	it("shows the fallback, or nothing, when it does not", async () => {
		await renderWith(
			[],
			<>
				<Can I="LIST" a="SERVER_METRIC" passThrough>
					{({ isAllowed }: { readonly isAllowed: boolean }): React.ReactNode => (isAllowed ? <Text>servers</Text> : <Text>no access</Text>)}
				</Can>
				<Can I="LIST" a="SERVER_METRIC">
					<Text>hidden</Text>
				</Can>
			</>,
		);

		expect(screen.getByText("no access")).toBeOnTheScreen();
		expect(screen.queryByText("servers")).toBeNull();
		expect(screen.queryByText("hidden")).toBeNull();
	});

	it("checks several capabilities: any of them, or all of them", async () => {
		function Several(): React.JSX.Element {
			const ability = useAbility();
			const github = ability.can("READ", "GITHUB_PULL_REQUEST");
			const servers = ability.can("LIST", "SERVER_METRIC");
			return (
				<>
					{github || servers ? <Text>any</Text> : null}
					{github && servers ? <Text>all</Text> : null}
				</>
			);
		}
		await renderWith([GITHUB_READ], <Several />);

		expect(screen.getByText("any")).toBeOnTheScreen();
		expect(screen.queryByText("all")).toBeNull();
	});

	it("builds the ability from platform capabilities only", async () => {
		await renderWith(
			[MERCHANT_CAPABILITY.viewRewards],
			<Can I="READ" a="REWARD" passThrough>
				{({ isAllowed }: { readonly isAllowed: boolean }): React.ReactNode => <Text>{isAllowed ? "rewards" : "no rewards"}</Text>}
			</Can>,
		);

		expect(screen.getByText("no rewards")).toBeOnTheScreen();
	});

	it("holds no capabilities and allows nothing outside a provider (fail closed), without crashing the screen", async () => {
		await render(<HeldCount />);
		expect(screen.getByText("0 held")).toBeOnTheScreen();

		await render(<Probe />);
		expect(screen.getByText("may not list servers · 0 held")).toBeOnTheScreen();

		await render(
			<Can I="LIST" a="SERVER_METRIC" passThrough>
				{({ isAllowed }: { readonly isAllowed: boolean }): React.ReactNode => <Text>{isAllowed ? "servers" : "no servers"}</Text>}
			</Can>,
		);
		expect(screen.getByText("no servers")).toBeOnTheScreen();
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
