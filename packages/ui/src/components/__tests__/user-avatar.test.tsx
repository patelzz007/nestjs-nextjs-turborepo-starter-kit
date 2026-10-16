// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { stubLoadedImages } from "../testing/loaded-image-stub";
import { UserAvatar } from "./user-avatar";

const PICTURE = {
	url: "https://cdn.example.com/users/ada/avatar.webp",
	sources: [
		{ width: 512, url: "https://cdn.example.com/users/ada/large.webp" },
		{ width: 128, url: "https://cdn.example.com/users/ada/thumbnail.webp" },
	],
};

let restoreImages: () => void;

beforeEach((): void => {
	restoreImages = stubLoadedImages();
});

afterEach((): void => {
	cleanup();
	restoreImages();
});

describe("UserAvatar", () => {
	it("shows the person's initials when they have no picture", () => {
		render(<UserAvatar name="Ada Lovelace" image={null} drawnSize={28} />);

		expect(screen.getByText("AL")).toBeTruthy();
		expect(document.querySelector("img")).toBeNull();
	});

	it("shows the picture from its renditions, at the size it is drawn", () => {
		render(<UserAvatar name="Ada Lovelace" image={PICTURE} drawnSize={28} />);

		const picture = document.querySelector("img");
		expect(picture?.getAttribute("src")).toBe(PICTURE.url);
		expect(picture?.getAttribute("srcset")).toBe("https://cdn.example.com/users/ada/thumbnail.webp 128w, https://cdn.example.com/users/ada/large.webp 512w");
		expect(picture?.getAttribute("sizes")).toBe("28px");
	});

	it("is decorative by default (the name is shown beside it), or named when asked", () => {
		const { rerender } = render(<UserAvatar name="Ada Lovelace" image={PICTURE} drawnSize={28} />);
		expect(document.querySelector("img")?.getAttribute("alt")).toBe("");

		rerender(<UserAvatar name="Ada Lovelace" image={PICTURE} drawnSize={28} alt="Ada Lovelace" />);
		expect(screen.getByRole("img", { name: "Ada Lovelace" })).toBeTruthy();
	});

	it("serves a picture without renditions from its own URL alone", () => {
		render(<UserAvatar name="Ada Lovelace" image={{ url: PICTURE.url }} drawnSize={28} />);

		expect(document.querySelector("img")?.hasAttribute("srcset")).toBe(false);
	});
});
