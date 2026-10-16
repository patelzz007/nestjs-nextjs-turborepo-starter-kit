import { fireEvent, render, screen } from "@testing-library/react-native";
import InboxIcon from "lucide-react-native/icons/inbox";
import * as React from "react";
import type { View } from "react-native";

import { Button } from "../button";
import { EmptyState, ErrorState, LoadingState } from "../empty";

describe("LoadingState", () => {
	it("announces what is loading once, as a progress bar", async () => {
		await render(<LoadingState label="Loading your devices…" />);

		expect(screen.getByRole("progressbar", { name: "Loading your devices…" })).toBeOnTheScreen();
		// The spinner inside is decorative: only the state itself is announced.
		expect(screen.getAllByRole("progressbar")).toHaveLength(1);
	});

	it("forwards its ref and merges the caller's className last", async () => {
		const ref = React.createRef<View>();
		await render(<LoadingState ref={ref} label="Loading" className="py-4" />);

		expect(ref.current).not.toBeNull();
		const className = String(screen.getByRole("progressbar", { name: "Loading" }).props.className);
		expect(className).toContain("py-4");
		expect(className).not.toContain("py-8");
	});
});

describe("EmptyState", () => {
	it("shows an empty message", async () => {
		await render(<EmptyState message="Nothing here" />);
		expect(screen.getByText("Nothing here")).toBeOnTheScreen();
	});

	it("shows a title, a glyph and a way forward", async () => {
		const onCreate = jest.fn();
		await render(
			<EmptyState title="No devices" message="Sign in on another device to see it here." icon={InboxIcon}>
				<Button label="Add a device" onPress={onCreate} />
			</EmptyState>,
		);

		expect(screen.getByText("No devices")).toBeOnTheScreen();
		await fireEvent.press(screen.getByRole("button", { name: "Add a device" }));
		expect(onCreate).toHaveBeenCalledTimes(1);
	});

	it("forwards its ref and merges the caller's className last", async () => {
		const ref = React.createRef<View>();
		await render(<EmptyState ref={ref} message="Nothing" className="py-10" testID="empty" />);

		expect(ref.current).not.toBeNull();
		const className = String(screen.getByTestId("empty").props.className);
		expect(className).toContain("py-10");
		expect(className).not.toContain("py-6");
	});
});

describe("ErrorState", () => {
	it("shows an error with a retry", async () => {
		const onRetry = jest.fn();
		await render(<ErrorState message="Could not load" retryLabel="Try again" onRetry={onRetry} />);

		expect(screen.getByRole("alert")).toHaveTextContent("Could not load");
		await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
		expect(onRetry).toHaveBeenCalledTimes(1);
	});

	it("blocks the retry while one is in flight", async () => {
		const onRetry = jest.fn();
		await render(<ErrorState message="Could not load" retryLabel="Try again" onRetry={onRetry} retrying />);

		const retry = screen.getByRole("button", { name: "Try again" });
		expect(retry).toBeBusy();
		await fireEvent.press(retry);
		expect(onRetry).not.toHaveBeenCalled();
	});

	it("forwards its ref", async () => {
		const ref = React.createRef<View>();
		await render(<ErrorState ref={ref} message="Failed" retryLabel="Retry" onRetry={jest.fn()} />);
		expect(ref.current).not.toBeNull();
	});
});
