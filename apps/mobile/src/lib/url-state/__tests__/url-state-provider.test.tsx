import { fireEvent, waitFor } from "@testing-library/react-native";
import { defineUrlState, optionalUrlParam, pageUrlParam } from "@workspace/shared";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { renderRouter, screen } from "expo-router/testing-library";
import * as React from "react";
import { Pressable, Text } from "react-native";
import { z } from "zod";

import { routeParamsOf, UrlStateProvider } from "../url-state-provider";
import { useUrlState } from "../use-url-state";

const LIST_URL_STATE = defineUrlState({ page: pageUrlParam(), status: optionalUrlParam(z.enum(["active", "locked"])) });

function RootLayout(): React.JSX.Element {
	return (
		<UrlStateProvider>
			<Stack />
		</UrlStateProvider>
	);
}

/** A list: its page and filter live in its own URL. */
function ListScreen(): React.JSX.Element {
	const [{ page, status }, update] = useUrlState(LIST_URL_STATE);
	const router = useRouter();
	const next = React.useCallback((): void => {
		update({ page: page + 1, status: "locked" });
	}, [page, update]);
	const openMember = React.useCallback((): void => {
		router.push({ pathname: "/team/[id]", params: { id: "3" } });
	}, [router]);
	return (
		<>
			<Text testID="list-state">{`${String(page)}:${status ?? "any"}`}</Text>
			<Pressable accessibilityRole="button" accessibilityLabel="Next locked page" onPress={next} />
			<Pressable accessibilityRole="button" accessibilityLabel="Open member" onPress={openMember} />
		</>
	);
}

/** A screen with a path param and its own `?page=`. */
function MemberScreen(): React.JSX.Element {
	const [{ page }, update] = useUrlState(LIST_URL_STATE);
	const { id } = useLocalSearchParams();
	const firstPage = React.useCallback((): void => {
		update({ page: 1 });
	}, [update]);
	const later = React.useCallback((): void => {
		update({ page: 2 });
	}, [update]);
	return (
		<>
			<Text testID="member-state">{`${String(id)}:${String(page)}`}</Text>
			<Pressable accessibilityRole="button" accessibilityLabel="Member page two" onPress={later} />
			<Pressable accessibilityRole="button" accessibilityLabel="Member first page" onPress={firstPage} />
		</>
	);
}

async function renderApp(initialUrl: string): Promise<void> {
	await renderRouter({ _layout: RootLayout, index: ListScreen, "team/[id]": MemberScreen }, { initialUrl });
}

describe("UrlStateProvider (nuqs on Expo Router)", () => {
	it("opens a deep link on the state it names", async () => {
		await renderApp("/?page=3&status=active");

		expect(screen.getByTestId("list-state")).toHaveTextContent("3:active");
	});

	it("writes an update into the screen's own params", async () => {
		await renderApp("/");

		await fireEvent.press(screen.getByRole("button", { name: "Next locked page" }));

		expect(screen.getByTestId("list-state")).toHaveTextContent("2:locked");
		await waitFor(() => {
			expect(screen).toHaveSearchParams({ page: "2", status: "locked" });
		});
	});

	it("drops a param that returns to its default, keeping the path params, and leaves the screen below untouched", async () => {
		await renderApp("/?page=4");
		await fireEvent.press(screen.getByRole("button", { name: "Open member" }));
		expect(await screen.findByTestId("member-state")).toHaveTextContent("3:1");

		await fireEvent.press(screen.getByRole("button", { name: "Member page two" }));
		await waitFor(() => {
			expect(screen).toHaveSearchParams({ id: "3", page: "2" });
		});
		await fireEvent.press(screen.getByRole("button", { name: "Member first page" }));

		await waitFor(() => {
			expect(screen).toHaveSearchParams({ id: "3" });
		});
		expect(screen.getByTestId("member-state")).toHaveTextContent("3:1");
		expect(screen.getByTestId("list-state", { includeHiddenElements: true })).toHaveTextContent("4:any");
	});
});

describe("routeParamsOf", () => {
	it("gives one value per key, and every value of a repeated key", () => {
		expect(routeParamsOf(new URLSearchParams("page=2&tag=a&tag=b"))).toEqual({ page: "2", tag: ["a", "b"] });
		expect(routeParamsOf(new URLSearchParams(""))).toEqual({});
	});
});
