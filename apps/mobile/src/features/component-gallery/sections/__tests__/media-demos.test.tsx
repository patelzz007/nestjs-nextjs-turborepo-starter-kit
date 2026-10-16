import { fireEvent, render, screen, within } from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";
import * as React from "react";

import { MediaDemos } from "../media-demos";

// The clipboard is the OS's: the boundary is replaced, the demo's own state is real.
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));

const DEMO_TITLES: readonly string[] = ["Carousel", "ImageCarousel", "CoverImage", "CodeBlock", "QrCode", "Bubble", "Message", "Attachment"];

describe("MediaDemos", () => {
	it("shows one demo block per component", async () => {
		await render(<MediaDemos />);
		for (const title of DEMO_TITLES) {
			expect(within(screen.getByTestId(`demo-${title}`)).getByText(title)).toBeOnTheScreen();
		}
	});

	it("moves the tips carousel with its dots", async () => {
		await render(<MediaDemos />);
		const carousel = within(screen.getByTestId("demo-Carousel"));

		expect(carousel.getByText("Showing tip 1 of 3")).toBeOnTheScreen();
		await fireEvent.press(carousel.getByRole("button", { name: "Slide 3 of 3" }));
		expect(carousel.getByText("Showing tip 3 of 3")).toBeOnTheScreen();
		expect(carousel.getByText("Secure by design")).toBeOnTheScreen();
	});

	it("moves the image carousel, each picture named by its alt text", async () => {
		await render(<MediaDemos />);
		const gallery = within(screen.getByTestId("demo-ImageCarousel"));

		expect(gallery.getByRole("image", { name: "The app icon, as a reward photo" })).toBeOnTheScreen();
		await fireEvent.press(gallery.getByRole("button", { name: "Slide 2 of 3" }));
		expect(gallery.getByRole("image", { name: "The launch artwork, as a second photo" })).toBeOnTheScreen();
		expect(gallery.queryByRole("image", { name: "The app icon, as a reward photo" })).toBeNull();
	});

	it("copies the code through the clipboard and shows it copied", async () => {
		await render(<MediaDemos />);

		await fireEvent.press(screen.getByRole("button", { name: "Copy code" }));
		expect(Clipboard.setStringAsync).toHaveBeenCalledWith(expect.stringContaining("auth.signIn"));
		expect(await screen.findByRole("button", { name: "Copied" })).toBeOnTheScreen();
	});

	it("names the QR codes and the placeholder cover", async () => {
		await render(<MediaDemos />);
		expect(screen.getByRole("image", { name: "Reward redemption QR code" })).toBeOnTheScreen();
		expect(screen.getByRole("image", { name: "Store front photo pending" })).toBeOnTheScreen();
		expect(screen.getByRole("image", { name: "The app icon" })).toBeOnTheScreen();
	});

	it("opens, removes and restores files", async () => {
		await render(<MediaDemos />);
		const files = within(screen.getByTestId("demo-Attachment"));

		await fireEvent.press(files.getByRole("button", { name: "spring-menu.jpg, 2.4 MB · Image" }));
		expect(files.getByText("Opened spring-menu.jpg")).toBeOnTheScreen();

		await fireEvent.press(files.getByRole("button", { name: "Remove spring-menu.jpg" }));
		expect(files.queryByText("spring-menu.jpg")).toBeNull();

		await fireEvent.press(files.getByRole("button", { name: "Restore the removed files" }));
		expect(files.getByText("spring-menu.jpg")).toBeOnTheScreen();
		expect(files.getByLabelText("contract-signed.pdf, Uploading… 40%")).toBeBusy();
	});
});
