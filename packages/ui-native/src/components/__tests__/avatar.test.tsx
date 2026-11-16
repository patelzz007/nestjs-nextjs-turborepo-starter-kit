import CheckIcon from "lucide-react-native/icons/check";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { getEntityAvatarTone } from "@workspace/shared";
import * as React from "react";
import { PixelRatio, type ViewInstance } from "react-native";

import { AVATAR_POINTS, Avatar, initialsOf, type AvatarSize } from "../avatar";

const SIZES: readonly AvatarSize[] = ["sm", "md", "row", "lg"];

function classNameOf(testID: string): string {
	return String(screen.getByTestId(testID).props.className);
}

describe("Avatar", () => {
	it("takes the drawer's tones: the sign-in panel's ink, and a filled disc", async () => {
		const view = await render(<Avatar name="Alex" imageUrl={null} tone="panel" />);
		expect(screen.getByText("A")).toHaveProp("className", expect.stringContaining("text-auth-panel"));

		await view.rerender(<Avatar name="Alex" imageUrl={null} tone="solid" />);
		expect(screen.getByText("A")).toHaveProp("className", expect.stringContaining("text-primary-foreground"));
	});

	it("shows the initials without a picture, named for screen readers", async () => {
		await render(<Avatar name="Alex Morgan" imageUrl={null} />);
		expect(screen.getByLabelText("Alex Morgan's initials")).toHaveTextContent("AM");
	});

	it("shows the picture when there is one", async () => {
		await render(<Avatar name="Alex Morgan" imageUrl="https://cdn.example.com/a.png" />);
		expect(screen.getByLabelText("Alex Morgan's profile picture")).toBeOnTheScreen();
		expect(screen.queryByText("AM")).toBeNull();
	});

	it("takes an accessible name other than the default", async () => {
		await render(<Avatar name="Acme" imageUrl="https://cdn.example.com/acme.png" shape="rounded" accessibilityLabel="Acme's logo" />);
		expect(screen.getByLabelText("Acme's logo")).toBeOnTheScreen();
	});

	it.each(SIZES)("draws a %s picture at its size in points", async (size: AvatarSize) => {
		await render(<Avatar name="octocat" imageUrl="https://avatars.githubusercontent.com/u/1" size={size} />);

		const picture = screen.getByLabelText("octocat's profile picture");
		expect(picture).toHaveProp("width", AVATAR_POINTS[size]);
		expect(picture).toHaveProp("height", AVATAR_POINTS[size]);
	});

	it("is round for a person and a rounded square for a tenant", async () => {
		const view = await render(<Avatar name="Alex" imageUrl={null} testID="avatar" />);
		expect(classNameOf("avatar")).toContain("rounded-full");

		await view.rerender(<Avatar name="Acme" imageUrl={null} shape="rounded" size="md" testID="avatar" />);
		expect(classNameOf("avatar")).toContain("rounded-lg");
		expect(classNameOf("avatar")).not.toContain("rounded-full");
	});

	it("is a soft grey disc with ink initials, and inverts its colours on a primary surface", async () => {
		const view = await render(<Avatar name="Alex" imageUrl={null} testID="avatar" />);
		expect(classNameOf("avatar")).toContain("bg-muted");
		expect(screen.getByText("A")).toHaveProp("className", expect.stringContaining("text-foreground"));

		await view.rerender(<Avatar name="Alex" imageUrl={null} tone="inverse" testID="avatar" />);
		expect(classNameOf("avatar")).toContain("bg-primary-foreground");
		expect(screen.getByText("A")).toHaveProp("className", expect.stringContaining("text-primary"));
	});

	it("forwards its ref, with or without a picture", async () => {
		const initialsRef = React.createRef<ViewInstance>();
		const pictureRef = React.createRef<ViewInstance>();
		await render(
			<>
				<Avatar ref={initialsRef} name="Alex" imageUrl={null} />
				<Avatar ref={pictureRef} name="Sam" imageUrl="https://cdn.example.com/s.png" />
			</>,
		);
		expect(initialsRef.current).not.toBeNull();
		expect(pictureRef.current).not.toBeNull();
	});

	it("merges the caller's className last", async () => {
		await render(<Avatar name="Alex" imageUrl={null} size="sm" className="size-10" testID="avatar" />);
		expect(classNameOf("avatar")).toContain("size-10");
		expect(classNameOf("avatar")).not.toContain("size-6");
	});
});

describe("initialsOf", () => {
	it.each([
		["Alex Morgan", "AM"],
		["alex", "A"],
		["  Ana  Maria  Lopez ", "AM"],
		["", ""],
	])("initials of %j are %j", (name: string, initials: string) => {
		expect(initialsOf(name)).toBe(initials);
	});
});

describe("Avatar renditions, logos and name tints", () => {
	const SOURCES = [
		{ width: 256, url: "https://cdn.example.com/256.png" },
		{ width: 64, url: "https://cdn.example.com/64.png" },
		{ width: 128, url: "https://cdn.example.com/128.png" },
	];

	it("shows the rendition that is sharp at its size on this screen", async () => {
		const ratio = PixelRatio.getPixelSizeForLayoutSize(AVATAR_POINTS.lg);
		await render(<Avatar name="Ada Lovelace" imageUrl="https://cdn.example.com/original.png" sources={SOURCES} />);
		const expected =
			SOURCES.filter((source) => source.width >= ratio)
				.sort((a, b) => a.width - b.width)
				.at(0)?.url ?? "https://cdn.example.com/256.png";
		expect(screen.getByLabelText("Ada Lovelace's profile picture")).toHaveProp("source", { uri: expected });
	});

	it("falls back to the initials when the picture fails to load", async () => {
		await render(<Avatar name="Ada Lovelace" imageUrl="https://cdn.example.com/broken.png" />);
		await fireEvent(screen.getByLabelText("Ada Lovelace's profile picture"), "error");
		expect(screen.getByLabelText("Ada Lovelace's initials")).toBeOnTheScreen();
	});

	it("contains a logo on a plain tile, and tints a mark's monogram from its name", async () => {
		const { rerender } = await render(<Avatar name="Acme Coffee" imageUrl="https://cdn.example.com/logo.png" shape="rounded" />);
		expect(screen.getByLabelText("Acme Coffee logo")).toHaveProp("resizeMode", "contain");
		await rerender(<Avatar name="Acme Coffee" imageUrl={null} shape="rounded" tone="name" testID="mark" />);
		expect(screen.getByTestId("mark")).toHaveProp("className", expect.stringContaining(`bg-${getEntityAvatarTone("Acme Coffee")}/20`));
	});
});

describe("Avatar colours, rings, badges and loading", () => {
	it("fills its initials softly or solidly in a colour, at the new sizes", async () => {
		const { rerender } = await render(<Avatar name="Ada Lovelace" imageUrl={null} tone="soft" color="success" size="xs" testID="avatar" />);
		expect(screen.getByTestId("avatar")).toHaveProp("className", expect.stringContaining("bg-tone-green-soft"));
		await rerender(<Avatar name="Ada Lovelace" imageUrl={null} tone="filled" color="violet" size="xl" testID="avatar" />);
		expect(screen.getByTestId("avatar")).toHaveProp("className", expect.stringContaining("bg-tone-violet"));
	});

	it("draws a ring, named badges on its corners and a loading veil", async () => {
		await render(
			<Avatar
				name="Ada Lovelace"
				imageUrl="https://cdn.example.com/ada.png"
				ring="destructive"
				loading
				badges={[
					{ label: "Online", color: "success" },
					{ label: "3 unread", count: 3, color: "destructive", position: "top-right" },
					{ label: "Verified", icon: CheckIcon, color: "info", position: "top-left" },
				]}
				testID="avatar"
			/>,
		);
		expect(screen.getByLabelText("Online")).toBeOnTheScreen();
		expect(screen.getByText("3")).toBeOnTheScreen();
		expect(screen.getByLabelText("Verified")).toBeOnTheScreen();
		expect(screen.getByLabelText("Updating Ada Lovelace's picture")).toHaveProp("accessibilityState", { busy: true });
	});
});
