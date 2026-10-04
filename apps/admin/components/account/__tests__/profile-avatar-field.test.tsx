// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProfileAvatarField } from "../profile-avatar-field";

function renderField(overrides: Partial<React.ComponentProps<typeof ProfileAvatarField>> = {}): {
	readonly onPick: ReturnType<typeof vi.fn<(file: File) => void>>;
	readonly onRemove: ReturnType<typeof vi.fn<() => void>>;
} {
	const onPick = vi.fn<(file: File) => void>();
	const onRemove = vi.fn<() => void>();
	render(
		<ProfileAvatarField
			avatarUrl={null}
			initials="RU"
			accept="image/jpeg,image/png"
			hint="JPEG or PNG, up to 10 MB."
			isBusy={false}
			isReadOnly={false}
			onPick={onPick}
			onRemove={onRemove}
			{...overrides}
		/>,
	);
	return { onPick, onRemove };
}

function fileInput(): HTMLInputElement {
	const input = screen.getByLabelText("Avatar image");
	if (!(input instanceof HTMLInputElement)) {
		throw new Error("Avatar image is not an input");
	}
	return input;
}

describe("ProfileAvatarField", () => {
	afterEach(() => {
		cleanup();
	});

	it("offers an upload with a labelled, described file input limited to the given types", () => {
		renderField();

		expect(fileInput().accept).toBe("image/jpeg,image/png");
		expect(fileInput().getAttribute("aria-describedby")).toBe(screen.getByText("JPEG or PNG, up to 10 MB.").id);
		expect(screen.getByRole("button", { name: "Upload avatar" })).toBeTruthy();
		expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
	});

	it("hands the picked file to the caller", () => {
		const { onPick } = renderField();
		const image = new File([new Uint8Array(4)], "me.png", { type: "image/png" });

		fireEvent.change(fileInput(), { target: { files: [image] } });

		expect(onPick).toHaveBeenCalledWith(image);
	});

	it("offers replace and remove when there is an avatar", () => {
		const { onRemove } = renderField({ avatarUrl: "https://cdn.example.com/a.png" });

		expect(screen.getByRole("button", { name: "Replace avatar" })).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Remove" }));
		expect(onRemove).toHaveBeenCalledTimes(1);
	});

	it("disables every control while busy or read-only", () => {
		renderField({ avatarUrl: "https://cdn.example.com/a.png", isReadOnly: true });

		expect(fileInput().disabled).toBe(true);
		expect(screen.getByRole("button", { name: "Replace avatar" }).hasAttribute("disabled")).toBe(true);
		expect(screen.getByRole("button", { name: "Remove" }).hasAttribute("disabled")).toBe(true);
	});
});
