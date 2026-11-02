import { fireEvent, render, screen } from "@testing-library/react-native";
import ShieldIcon from "lucide-react-native/icons/shield";
import * as React from "react";
import { Text, type ViewInstance } from "react-native";

import { NotificationRow, notificationRowBadgeVariants, type NotificationRowProps } from "../notification-row";

/** 16 Oct 2026, 06:00 UTC. */
const NOW = Date.UTC(2026, 9, 16, 6, 0, 0);
const MINUTE_MS = 60_000;
const TWENTY_FIVE = 25;

const BASE: NotificationRowProps = {
	title: "New sign-in to your account",
	body: "Chrome on macOS signed in from Kuala Lumpur.",
	sender: null,
	icon: ShieldIcon,
	tone: "red",
	createdAt: NOW - TWENTY_FIVE * MINUTE_MS,
	now: NOW,
	locale: "en-MY",
	unread: false,
	onPress: jest.fn(),
	testID: "row",
};

function row(): ReturnType<typeof screen.getByTestId> {
	return screen.getByTestId("row");
}

describe("NotificationRow", () => {
	it("runs the bold title into the message, with a feed's short time under it", async () => {
		await render(<NotificationRow {...BASE} />);

		expect(screen.getByText("New sign-in to your account")).toBeOnTheScreen();
		expect(screen.getByText("25m")).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: "New sign-in to your account. Chrome on macOS signed in from Kuala Lumpur.. 25m" })).toBeOnTheScreen();
	});

	it("tints an unread row, puts its time in the brand colour, ends it with a dot and says so", async () => {
		await render(<NotificationRow {...BASE} unread />);

		expect(String(row().props.className)).toContain("bg-primary/10");
		expect(String(screen.getByText("25m").props.className)).toContain("text-primary");
		expect(screen.getByTestId("row-unread", { includeHiddenElements: true })).toBeOnTheScreen();
		expect(screen.getByRole("button", { name: /^Unread\. New sign-in/u })).toBeOnTheScreen();
	});

	it("leaves a read row plain", async () => {
		await render(<NotificationRow {...BASE} />);

		expect(String(row().props.className)).not.toContain("bg-primary/10");
		expect(screen.queryByTestId("row-unread", { includeHiddenElements: true })).toBeNull();
	});

	it("leads with the sender's initials and the kind's glyph on their corner", async () => {
		await render(<NotificationRow {...BASE} sender={{ name: "Kopi & Co", imageUrl: null }} tone="orange" />);

		expect(screen.getByText("K&", { includeHiddenElements: true })).toBeOnTheScreen();
		expect(notificationRowBadgeVariants({ tone: "orange" })).toContain("bg-tone-orange");
	});

	it("opens on a press, and keeps its trailing menu outside that button", async () => {
		const onPress = jest.fn();
		const onMore = jest.fn();
		await render(<NotificationRow {...BASE} onPress={onPress} trailing={<Text onPress={onMore}>More</Text>} />);

		await fireEvent.press(screen.getByTestId("row-open"));
		expect(onPress).toHaveBeenCalledTimes(1);
		await fireEvent.press(screen.getByText("More"));
		expect(onMore).toHaveBeenCalledTimes(1);
		expect(onPress).toHaveBeenCalledTimes(1);
	});

	it("speaks the caller's word for unread, forwards its ref and merges className last", async () => {
		const ref = React.createRef<ViewInstance>();
		await render(<NotificationRow {...BASE} ref={ref} unread unreadLabel="Belum dibaca" className="rounded-none" />);

		expect(ref.current).not.toBeNull();
		expect(screen.getByRole("button", { name: /^Belum dibaca\./u })).toBeOnTheScreen();
		expect(String(row().props.className)).not.toContain("rounded-xl");
	});
});
