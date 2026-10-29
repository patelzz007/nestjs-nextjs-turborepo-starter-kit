import { render, renderHook, screen } from "@testing-library/react-native";
import { defineUrlState, pageUrlParam } from "@workspace/shared";
import * as React from "react";
import { Text } from "react-native";

import { UrlStateTestProvider } from "../url-state-test-provider";
import { useUrlState } from "../use-url-state";

const PAGE_URL_STATE = defineUrlState({ page: pageUrlParam() });

function PageLabel(): React.JSX.Element {
	const [{ page }] = useUrlState(PAGE_URL_STATE);
	return <Text testID="page">{String(page)}</Text>;
}

describe("UrlStateTestProvider", () => {
	it("opens on the query it is given, and on none by default", async () => {
		const view = await render(
			<UrlStateTestProvider searchParams="?page=5">
				<PageLabel />
			</UrlStateTestProvider>,
		);
		expect(screen.getByTestId("page")).toHaveTextContent("5");

		await view.rerender(
			<UrlStateTestProvider key="fresh">
				<PageLabel />
			</UrlStateTestProvider>,
		);
		expect(screen.getByTestId("page")).toHaveTextContent("1");
	});

	it("refuses a URL-state hook rendered outside it", async () => {
		const quiet = jest.spyOn(console, "error").mockImplementation((): void => undefined);

		await expect(renderHook(() => useUrlState(PAGE_URL_STATE))).rejects.toThrow();

		quiet.mockRestore();
	});
});
