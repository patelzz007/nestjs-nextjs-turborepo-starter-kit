import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { defineUrlState, optionalUrlParam, pageUrlParam } from "@workspace/shared";
import * as React from "react";
import { Pressable, Text } from "react-native";
import { z } from "zod";

import { UrlStateTestProvider, type UrlUpdateEvent } from "../url-state-test-provider";
import { useUrlState } from "../use-url-state";

const LIST_URL_STATE = defineUrlState({ page: pageUrlParam(), status: optionalUrlParam(z.enum(["active", "locked"])) }, { urlKeys: { status: "filter[status]" } });

/** A list screen's controls: shows the state, and changes it the way a screen does. */
function ListControls(): React.JSX.Element {
	const [state, update] = useUrlState(LIST_URL_STATE);
	const nextPage = React.useCallback((): void => {
		update({ page: state.page + 1 });
	}, [state.page, update]);
	const lockAndRestart = React.useCallback((): void => {
		update({ status: "locked" });
		update({ page: 1 }, { history: "replace" });
	}, [update]);
	const samePage = React.useCallback((): void => {
		update({ page: state.page });
	}, [state.page, update]);
	return (
		<>
			<Text testID="state">{`${String(state.page)}:${state.status ?? "any"}`}</Text>
			<Pressable accessibilityRole="button" accessibilityLabel="Next page" onPress={nextPage} />
			<Pressable accessibilityRole="button" accessibilityLabel="Locked only" onPress={lockAndRestart} />
			<Pressable accessibilityRole="button" accessibilityLabel="Same page" onPress={samePage} />
		</>
	);
}

async function renderControls(searchParams: string, onUrlUpdate?: (event: UrlUpdateEvent) => void): Promise<void> {
	await render(
		<UrlStateTestProvider searchParams={searchParams} {...(onUrlUpdate === undefined ? {} : { onUrlUpdate })}>
			<ListControls />
		</UrlStateTestProvider>,
	);
}

describe("useUrlState", () => {
	it("parses the screen's params, an invalid one falling back to its default", async () => {
		await renderControls("?page=3&filter[status]=nope");

		expect(screen.getByTestId("state")).toHaveTextContent("3:any");
	});

	it("changes the state at once and writes the params on the next tick, defaults left out", async () => {
		const onUrlUpdate = jest.fn<undefined, [UrlUpdateEvent]>();
		await renderControls("", onUrlUpdate);

		await fireEvent.press(screen.getByRole("button", { name: "Next page" }));

		expect(screen.getByTestId("state")).toHaveTextContent("2:any");
		await waitFor(() => {
			expect(onUrlUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ queryString: "?page=2" }));
		});
	});

	it("composes updates made in the same tick into one write, a push among them making it a push", async () => {
		const onUrlUpdate = jest.fn<undefined, [UrlUpdateEvent]>();
		await renderControls("?page=4", onUrlUpdate);

		await fireEvent.press(screen.getByRole("button", { name: "Locked only" }));

		expect(screen.getByTestId("state")).toHaveTextContent("1:locked");
		await waitFor(() => {
			expect(onUrlUpdate).toHaveBeenCalledTimes(1);
		});
		const [write] = onUrlUpdate.mock.calls.flat();
		expect(write?.searchParams.toString()).toBe("filter%5Bstatus%5D=locked");
		expect(write?.options.history).toBe("push");
	});

	it("writes nothing when the update changes nothing", async () => {
		const onUrlUpdate = jest.fn<undefined, [UrlUpdateEvent]>();
		await renderControls("?page=2", onUrlUpdate);

		await fireEvent.press(screen.getByRole("button", { name: "Same page" }));
		await act(async (): Promise<void> => {
			await Promise.resolve();
		});

		expect(onUrlUpdate).not.toHaveBeenCalled();
		expect(screen.getByTestId("state")).toHaveTextContent("2:any");
	});
});
