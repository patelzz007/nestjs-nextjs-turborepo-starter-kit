// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { applyTheme, currentTheme } from "@/browser/theme";

import { HrefLink, isModifiedClick } from "../href-link";
import { NavTree } from "../nav-tree";
import { NotFoundPage } from "../not-found-page";
import { Pager } from "../pager";
import { SiteFooter } from "../site-footer";
import { ThemeToggle } from "../theme-toggle";
import { SECTIONS } from "./fixtures";
import { renderWithRouter } from "./render-with-router";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	applyTheme("light");
});

describe("NavTree", () => {
	it("should list every section's guides and mark only the current one", async () => {
		await renderWithRouter(<NavTree sections={SECTIONS} activeId="technical/authorization/backend" />);
		expect(screen.getByText("Authorization")).toBeTruthy();
		expect(screen.getByRole("link", { name: "Backend" }).getAttribute("aria-current")).toBe("page");
		expect(screen.getByRole("link", { name: "Authorization: start here" }).getAttribute("aria-current")).toBeNull();
		expect(screen.getByRole("link", { name: "Backend" }).getAttribute("href")).toBe("/docs/technical/authorization/backend");
	});

	it("should tell the caller when a guide is picked", async () => {
		const onNavigate = vi.fn();
		await renderWithRouter(<NavTree sections={SECTIONS} activeId={null} onNavigate={onNavigate} />);
		await act(async () => {
			fireEvent.click(screen.getByRole("link", { name: "Backend" }));
			await Promise.resolve();
		});
		expect(onNavigate).toHaveBeenCalledTimes(1);
	});
});

describe("HrefLink", () => {
	it("should navigate client-side on a plain click and keep modified clicks for the browser", async () => {
		const onClick = vi.fn();
		const { router } = await renderWithRouter(
			<HrefLink href="/docs/database#seed" onClick={onClick}>
				Seed data
			</HrefLink>,
		);
		const link = screen.getByRole("link", { name: "Seed data" });
		expect(fireEvent.click(link, { metaKey: true })).toBe(true);
		expect(router.state.location.pathname).toBe("/");
		await act(async () => {
			fireEvent.click(link);
			await router.load();
		});
		expect(router.state.location.pathname).toBe("/docs/database");
		expect(router.state.location.hash).toBe("seed");
		expect(onClick).toHaveBeenCalledTimes(2);
	});

	it("should treat any modifier, another button or a handled event as the browser's", () => {
		const plain = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false };
		expect(isModifiedClick(plain)).toBe(false);
		expect(isModifiedClick({ ...plain, button: 1 })).toBe(true);
		expect(isModifiedClick({ ...plain, ctrlKey: true })).toBe(true);
		expect(isModifiedClick({ ...plain, shiftKey: true })).toBe(true);
		expect(isModifiedClick({ ...plain, altKey: true })).toBe(true);
		expect(isModifiedClick({ ...plain, defaultPrevented: true })).toBe(true);
	});
});

describe("Pager", () => {
	it("should link to the previous and next pages", async () => {
		await renderWithRouter(<Pager previous={{ title: "Changelog", href: "/blog/changelog" }} next={{ title: "Epoch", href: "/blog/epoch" }} />);
		expect(screen.getByRole("link", { name: /Previous\s*Changelog/ }).getAttribute("href")).toBe("/blog/changelog");
		expect(screen.getByRole("link", { name: /Next\s*Epoch/ }).getAttribute("href")).toBe("/blog/epoch");
	});

	it("should keep the next card on the right when there is no previous page, and render nothing with neither", async () => {
		const { container, unmount } = await renderWithRouter(<Pager previous={null} next={{ title: "Epoch", href: "/blog/epoch" }} />);
		expect(screen.queryByText("Previous")).toBeNull();
		expect(container.querySelector("nav")?.childElementCount).toBe(2);
		unmount();
		await renderWithRouter(<Pager previous={null} next={null} />);
		expect(screen.queryByRole("navigation", { name: "Previous and next" })).toBeNull();
	});
});

describe("ThemeToggle", () => {
	it("should switch between light and dark on each click", async () => {
		await renderWithRouter(<ThemeToggle />);
		const toggle = screen.getByRole("button", { name: "Switch theme" });
		fireEvent.click(toggle);
		expect(currentTheme()).toBe("dark");
		fireEvent.click(toggle);
		expect(currentTheme()).toBe("light");
	});
});

describe("SiteFooter and NotFoundPage", () => {
	it("should link the footer to the guides, the blog, the feed and the repository", async () => {
		await renderWithRouter(<SiteFooter />);
		expect(screen.getByRole("link", { name: "RSS" }).getAttribute("href")).toBe("/feed.xml");
		expect(screen.getByRole("link", { name: "GitHub" }).getAttribute("target")).toBe("_blank");
	});

	it("should offer the guides and search on the 404 page", async () => {
		await renderWithRouter(<NotFoundPage />);
		expect(screen.getByText("404")).toBeTruthy();
		expect(screen.getByRole("link", { name: "Browse all guides" }).getAttribute("href")).toBe("/docs");
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Search" }));
			await Promise.resolve();
		});
		expect(screen.getByRole("dialog")).toBeTruthy();
	});
});

describe("IconSprite", () => {
	it("should draw each icon once and let the guide tree point at it", async () => {
		await renderWithRouter(<NavTree sections={SECTIONS} activeId={null} />);
		expect(document.querySelectorAll("symbol#docs-icon-shieldCheck")).toHaveLength(1);
		const link = screen.getByRole("link", { name: "Backend" });
		expect(link.querySelector("use")?.getAttribute("href")).toBe("#docs-icon-server");
	});
});
