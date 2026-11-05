// @vitest-environment jsdom
import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Feedback, FEEDBACK_STORAGE_PREFIX, readVote } from "../feedback";
import { PostList } from "../post-list";
import { POSTS } from "./fixtures";
import { renderWithRouter } from "./render-with-router";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	window.localStorage.clear();
});

describe("Feedback", () => {
	it("should remember a vote per page and thank the reader", async () => {
		await renderWithRouter(<Feedback path="docs/messaging.md" />);
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Yes" }));
			await Promise.resolve();
		});
		expect(window.localStorage.getItem(`${FEEDBACK_STORAGE_PREFIX}docs/messaging.md`)).toBe("yes");
		expect(screen.getByRole("button", { name: "Yes" }).getAttribute("aria-pressed")).toBe("true");
		expect(screen.getByRole("status").textContent).toBe("Thanks, noted for this browser.");
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "No" }));
			await Promise.resolve();
		});
		expect(readVote("docs/messaging.md")).toBe("no");
	});

	it("should show a vote stored earlier, and ignore an unreadable or unknown one", async () => {
		window.localStorage.setItem(`${FEEDBACK_STORAGE_PREFIX}docs/db.md`, "no");
		await renderWithRouter(<Feedback path="docs/db.md" />);
		expect(screen.getByRole("button", { name: "No" }).getAttribute("aria-pressed")).toBe("true");
		window.localStorage.setItem(`${FEEDBACK_STORAGE_PREFIX}docs/x.md`, "maybe");
		expect(readVote("docs/x.md")).toBeNull();
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("blocked");
		});
		expect(readVote("docs/db.md")).toBeNull();
	});

	it("should still acknowledge a vote when storage refuses it", async () => {
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("blocked");
		});
		await renderWithRouter(<Feedback path="docs/y.md" />);
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Yes" }));
			await Promise.resolve();
		});
		expect(screen.getByRole("button", { name: "Yes" }).getAttribute("aria-pressed")).toBe("false");
	});
});

describe("PostList", () => {
	it("should show every post with its category, date and reading time, linked to the post", async () => {
		await renderWithRouter(<PostList posts={POSTS} />);
		expect(screen.getByRole("heading", { level: 1, name: "Engineering Blog" })).toBeTruthy();
		expect(screen.getByRole("link", { name: "Why we moved the API from Express to Fastify" }).getAttribute("href")).toBe("/blog/fastify-migration");
		expect(screen.getByText("architecture")).toBeTruthy();
		expect(screen.getByText(/1 min read/)).toBeTruthy();
		expect(screen.getByRole("link", { name: "Subscribe with RSS" }).getAttribute("href")).toBe("/feed.xml");
	});

	it("should say how to add the first post when there is none", async () => {
		await renderWithRouter(<PostList posts={[]} />);
		expect(screen.getByText(/No posts yet/)).toBeTruthy();
	});
});
