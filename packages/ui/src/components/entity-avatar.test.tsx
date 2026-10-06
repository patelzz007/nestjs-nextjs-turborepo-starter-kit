// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EntityAvatar, getEntityAvatarTone } from "./entity-avatar";

const SHOP_NAME = "Brew & Bean KL";
const LOGO_URL = "https://cdn.example.com/organizations/brew-bean/logo.png";

afterEach((): void => {
	cleanup();
});

describe("EntityAvatar logo", () => {
	it("renders the logo lazily, uncropped, with the entity name as its alt text", (): void => {
		render(<EntityAvatar name={SHOP_NAME} src={LOGO_URL} />);

		const logo = screen.getByAltText(SHOP_NAME);
		expect(logo.getAttribute("src")).toBe(LOGO_URL);
		expect(logo.getAttribute("loading")).toBe("lazy");
		expect(logo.className).toContain("object-contain");
	});

	it("replaces the monogram with the logo once the logo has loaded", (): void => {
		render(<EntityAvatar name={SHOP_NAME} src={LOGO_URL} />);

		fireEvent.load(screen.getByAltText(SHOP_NAME));

		expect(screen.queryByText("BK")).toBeNull();
		expect(screen.getByRole("img", { name: SHOP_NAME })).toBeDefined();
	});

	it("falls back to the monogram when the logo fails to load", (): void => {
		render(<EntityAvatar name={SHOP_NAME} src={LOGO_URL} />);

		fireEvent.error(screen.getByAltText(SHOP_NAME));

		expect(screen.getByText("BK")).toBeDefined();
	});
});

describe("EntityAvatar monogram fallback", () => {
	it("shows up to two initials when there is no logo", (): void => {
		render(<EntityAvatar name={SHOP_NAME} src={null} />);

		expect(screen.getByText("BK")).toBeDefined();
		expect(screen.queryByRole("img")).toBeNull();
	});

	it("keeps the entity name available to assistive technology", (): void => {
		render(<EntityAvatar name="Kopi Co" />);

		expect(screen.getByText("KC").getAttribute("aria-hidden")).toBe("true");
		expect(screen.getByText("Kopi Co").className).toContain("sr-only");
	});

	it("tints the monogram with the name's deterministic chart tone", (): void => {
		render(<EntityAvatar name={SHOP_NAME} data-testid="avatar" />);

		const monogram = screen.getByText("BK").parentElement;
		const tone = getEntityAvatarTone(SHOP_NAME);
		expect(monogram?.getAttribute("data-tone")).toBe(tone);
		expect(monogram?.className).toContain(`bg-${tone}/20`);
	});
});

describe("EntityAvatar decorative mode", () => {
	it("hides itself from assistive technology when alt is empty (name shown as adjacent text)", (): void => {
		render(<EntityAvatar name={SHOP_NAME} src={LOGO_URL} alt="" data-testid="avatar" />);

		expect(screen.getByTestId("avatar").getAttribute("aria-hidden")).toBe("true");
		expect(screen.queryByText(SHOP_NAME)).toBeNull();
		expect(screen.getByTestId("avatar").querySelector("img")?.getAttribute("alt")).toBe("");
	});
});

describe("EntityAvatar contract", () => {
	it("forwards its ref to the root element", (): void => {
		const ref: { readonly current: HTMLSpanElement | null } = { current: null };

		render(<EntityAvatar ref={ref} name={SHOP_NAME} data-testid="avatar" />);

		expect(ref.current).toBe(screen.getByTestId("avatar"));
	});

	it("applies the size and shape variants", (): void => {
		render(<EntityAvatar name={SHOP_NAME} size="xl" shape="circle" data-testid="avatar" />);

		const avatar = screen.getByTestId("avatar");
		expect(avatar.className).toContain("size-16");
		expect(avatar.className).toContain("rounded-full");
	});
});

describe("getEntityAvatarTone", () => {
	it("is deterministic for the same name", (): void => {
		expect(getEntityAvatarTone(SHOP_NAME)).toBe(getEntityAvatarTone(SHOP_NAME));
	});

	it("ignores case and surrounding whitespace", (): void => {
		expect(getEntityAvatarTone("  brew & bean kl ")).toBe(getEntityAvatarTone(SHOP_NAME));
	});

	it("spreads different names across more than one tone", (): void => {
		const names: readonly string[] = ["Brew & Bean KL", "Jonker Street Kitchen", "Kopi Co", "Sunrise Café", "Nasi Lemak Corner", "Teh Tarik House"];
		const tones = new Set(names.map((name: string) => getEntityAvatarTone(name)));

		expect(tones.size).toBeGreaterThan(1);
	});

	it("tells the two demo shops apart (both used to land on the neutral grey slot)", (): void => {
		expect(getEntityAvatarTone("Brew & Bean KL")).not.toBe(getEntityAvatarTone("Jonker Street Kitchen"));
	});
});
