// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster, createToastManager, createToastMessage, toastA11yProps, toastPositionSchema, toastTypeSchema } from "@workspace/ui/components/feedback/toast";

// ── jsdom fidelity shim ────────────────────────────────────────────────────
// The window-blur/focus test dispatches `window.dispatchEvent(new Event("focus"))`.
// base-ui's ToastViewport window-focus handler runs `contains(viewport, window)`
// — the `window` object is not a `Node`. Real browsers return `false`; jsdom's
// `Node.contains` THROWS. Worse, jsdom `dispatchEvent` doesn't re-throw listener
// exceptions, so it surfaces as an unhandled error that fails the whole run.
// Mirror the browser: non-Node arguments return `false` instead of throwing.
// The original is captured as a plain function (with an explicit `this` type)
// and invoked only via `.call(this, other)` with a real receiver, so the
// `unbound-method` lint (which assumes method detaching loses `this`) doesn't
// apply — hence the disable on the next line.
// eslint-disable-next-line @typescript-eslint/unbound-method
const realNodeContains: (this: Node, other: Node | null) => boolean = Node.prototype.contains;

/** jsdom has no ResizeObserver; base-ui tolerates its absence, stub to be safe. */
class ResizeObserverStub {
	public observe(): void {
		return;
	}
	public unobserve(): void {
		return;
	}
	public disconnect(): void {
		return;
	}
}

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.useRealTimers();
	// Restore the shimmed `contains` so other test files see the pristine method.
	Node.prototype.contains = realNodeContains;
});

describe("Toast", () => {
	// A fresh manager + bound helpers per test — the module-scoped singleton is
	// deliberately NOT used so toasts can never leak between tests (feature 17).
	beforeEach(() => {
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		// Apply the jsdom `contains` fidelity shim (see header comment).
		Node.prototype.contains = function contains(this: Node, other: Node | null): boolean {
			if (other === null || !(other instanceof Node)) {
				return false;
			}
			return realNodeContains.call(this, other);
		};
	});

	it("renders a toast from the imperative manager with title + description (features 1/2)", () => {
		const manager = createToastManager();
		const message = createToastMessage(manager);
		render(<Toaster toastManager={manager} />);
		act(() => {
			message.success({ title: "Deploy complete", description: "v2.14.0 is live." });
		});
		expect(screen.getByText("Deploy complete")).toBeTruthy();
		expect(screen.getByText("v2.14.0 is live.")).toBeTruthy();
	});

	it("renders the per-type icon (improvement 2 icon map)", () => {
		const manager = createToastManager();
		const message = createToastMessage(manager);
		render(<Toaster toastManager={manager} />);
		act(() => {
			message.error({ title: "Refresh failed" });
		});
		// `getByText` would ALSO match base-ui's visually-hidden `role="alert"`
		// announce region (the viewport mirrors the title of high-priority toasts
		// for screen readers), so assert on the visible card title by slot.
		const titles = Array.from(document.querySelectorAll("[data-slot='toast-title']")).map((node) => node.textContent);
		expect(titles).toContain("Refresh failed");
		expect(document.querySelector("[data-slot='toast-icon'] svg")).toBeTruthy();
	});

	it("dismisses a toast when its close button is clicked (improvement 4 closeLabel)", () => {
		const manager = createToastManager();
		const message = createToastMessage(manager);
		render(<Toaster toastManager={manager} />);
		act(() => {
			message.info({ title: "Maintenance window" });
		});
		expect(screen.getByText("Maintenance window")).toBeTruthy();
		// base-ui sets `aria-hidden` on the close button until the toast is
		// expanded/focused (stacked-toast a11y), so query the DOM node directly
		// instead of `getByRole("button", { name: "Close toast" })`.
		const closeButton = document.querySelector("[data-slot='toast-close']");
		expect(closeButton).not.toBeNull();
		expect(closeButton?.getAttribute("aria-label")).toBe("Close toast");
		if (closeButton !== null) {
			fireEvent.click(closeButton);
		}
		expect(screen.queryByText("Maintenance window")).toBeNull();
	});

	it("dismisses all toasts (feature 7)", () => {
		const manager = createToastManager();
		const message = createToastMessage(manager);
		render(<Toaster toastManager={manager} />);
		act(() => {
			message.info({ title: "One" });
			message.warning({ title: "Two" });
		});
		expect(screen.getByText("One")).toBeTruthy();
		expect(screen.getByText("Two")).toBeTruthy();
		act(() => {
			message.dismiss();
		});
		expect(screen.queryByText("One")).toBeNull();
		expect(screen.queryByText("Two")).toBeNull();
	});

	it("auto-dismisses after the timeout (feature 6)", () => {
		const manager = createToastManager();
		const message = createToastMessage(manager);
		vi.useFakeTimers();
		render(<Toaster toastManager={manager} />);
		act(() => {
			message.success({ title: "Auto", timeout: 1000 });
		});
		expect(screen.getByText("Auto")).toBeTruthy();
		act(() => {
			vi.advanceTimersByTime(2500);
		});
		expect(screen.queryByText("Auto")).toBeNull();
	});

	it("renders a progress bar from typed data (feature 12)", () => {
		const manager = createToastManager();
		const message = createToastMessage(manager);
		render(<Toaster toastManager={manager} />);
		act(() => {
			message.loading({ title: "Backup", timeout: 0, data: { progress: 40 } });
		});
		const bar = screen.getByRole("progressbar");
		expect(bar.getAttribute("aria-valuenow")).toBe("40");
		const fill = bar.querySelector("div[style]");
		expect(fill?.getAttribute("style")).toContain("width: 40%");
	});

	it("drains an auto-dismiss countdown over the timeout (feature 6/12)", () => {
		const manager = createToastManager();
		const message = createToastMessage(manager);
		render(<Toaster toastManager={manager} />);
		act(() => {
			message.success({ title: "Countdown", timeout: 4000 });
		});
		const countdown = document.querySelector("[data-slot='toast-countdown']");
		expect(countdown).not.toBeNull();
		// The animated bar is the deepest div carrying the inline animation style.
		const animatedBar = countdown?.querySelector("div[style]");
		expect(animatedBar?.getAttribute("style")).toContain("animation: toast-countdown 4000ms linear forwards");
		// The ticking label starts at the full duration, rounded up to whole seconds.
		const label = document.querySelector("[data-slot='toast-countdown-label']");
		expect(label?.textContent).toBe("Dismisses in 4s");
	});

	it("ticks the countdown label down and freezes on hover/window-blur (feature 19)", () => {
		const manager = createToastManager();
		const message = createToastMessage(manager);
		vi.useFakeTimers();
		render(<Toaster toastManager={manager} />);
		act(() => {
			// A long timeout keeps base-ui's own dismiss timer out of the picture,
			// so this test isolates the label ticker's pause behavior.
			message.success({ title: "Ticker", timeout: 60000 });
		});
		const label = (): string | null => document.querySelector("[data-slot='toast-countdown-label']")?.textContent ?? null;
		expect(label()).toBe("Dismisses in 60s");

		// ~1.1s later it reads 59s.
		act(() => {
			vi.advanceTimersByTime(1100);
		});
		expect(label()).toBe("Dismisses in 59s");

		// Hovering freezes the ticker (mirrors base-ui's timer pause on hover).
		const card = document.querySelector("[data-slot='toast']");
		if (card !== null) {
			fireEvent.mouseEnter(card);
		}
		act(() => {
			vi.advanceTimersByTime(5000);
		});
		expect(label()).toBe("Dismisses in 59s");

		// Leaving resumes it from the frozen value.
		if (card !== null) {
			fireEvent.mouseLeave(card);
		}
		act(() => {
			vi.advanceTimersByTime(2000);
		});
		expect(label()).toBe("Dismisses in 57s");

		// Window blur freezes the ticker too (base-ui pauses its dismiss timer
		// while the window is blurred, so the label must not run ahead of it).
		// Dispatch inside `act` so React flushes `focused=false` (clearing the
		// interval) BEFORE the timers advance — the hover case above gets this
		// for free because fireEvent wraps in act.
		act(() => {
			window.dispatchEvent(new Event("blur"));
		});
		act(() => {
			vi.advanceTimersByTime(3000);
		});
		expect(label()).toBe("Dismisses in 57s");
		act(() => {
			window.dispatchEvent(new Event("focus"));
		});
		act(() => {
			vi.advanceTimersByTime(1000);
		});
		expect(label()).toBe("Dismisses in 56s");
	});

	it("freezes EVERY toast's label when ANY card is hovered (viewport-wide pause)", () => {
		const manager = createToastManager();
		const message = createToastMessage(manager);
		vi.useFakeTimers();
		render(<Toaster toastManager={manager} />);
		act(() => {
			message.success({ title: "First", timeout: 60000 });
			message.success({ title: "Second", timeout: 60000 });
		});
		const labels = (): (string | null)[] => Array.from(document.querySelectorAll("[data-slot='toast-countdown-label']")).map((node) => node.textContent);
		expect(labels()).toEqual(["Dismisses in 60s", "Dismisses in 60s"]);

		// Both tick down together.
		act(() => {
			vi.advanceTimersByTime(1100);
		});
		expect(labels()).toEqual(["Dismisses in 59s", "Dismisses in 59s"]);

		// Hover ONE card — BOTH labels must freeze (base-ui pauses every toast's
		// timer when ANY card is hovered; the label must mirror that or the text
		// desyncs from the real dismissal).
		const cards = Array.from(document.querySelectorAll("[data-slot='toast']"));
		const firstCard = cards[0];
		if (firstCard !== undefined) {
			fireEvent.mouseEnter(firstCard);
		}
		act(() => {
			vi.advanceTimersByTime(5000);
		});
		expect(labels()).toEqual(["Dismisses in 59s", "Dismisses in 59s"]);

		// Leaving resumes BOTH from the frozen value.
		if (firstCard !== undefined) {
			fireEvent.mouseLeave(firstCard);
		}
		act(() => {
			vi.advanceTimersByTime(1000);
		});
		expect(labels()).toEqual(["Dismisses in 58s", "Dismisses in 58s"]);
	});

	it("renders SOFT-SOLID cards + colored icons per type (opaque, not glassy)", () => {
		const manager = createToastManager();
		const message = createToastMessage(manager);
		render(<Toaster toastManager={manager} />);
		act(() => {
			message.success({ title: "Green" });
			message.error({ title: "Red" });
		});
		// Newest toast is first (store prepends).
		const cards = Array.from(document.querySelectorAll("[data-slot='toast']"));
		// Opaque soft-solid token backgrounds — no `/NN` alpha modifier, so nothing
		// bleeds through, but pale enough to be gentle (not a heavy solid block).
		expect(cards[0]?.className).toContain("bg-destructive-soft");
		expect(cards[0]?.className).not.toContain("bg-destructive/");
		expect(cards[1]?.className).toContain("bg-success-soft");
		expect(cards[1]?.className).not.toContain("bg-success/");
		const icons = Array.from(document.querySelectorAll("[data-slot='toast-icon'] svg"));
		expect(icons[0]?.getAttribute("class")).toContain("text-destructive");
		expect(icons[1]?.getAttribute("class")).toContain("text-success");
	});

	it("renders an action button and fires its onClick (feature 5)", () => {
		const manager = createToastManager();
		const message = createToastMessage(manager);
		render(<Toaster toastManager={manager} />);
		const onAction = vi.fn();
		act(() => {
			message.warning({
				title: "Action required",
				actionProps: { children: "Review", onClick: onAction },
			});
		});
		const action = screen.getByRole("button", { name: "Review" });
		fireEvent.click(action);
		expect(onAction).toHaveBeenCalledTimes(1);
	});

	it("flips a loading toast to success via update (feature 8)", () => {
		const manager = createToastManager();
		const message = createToastMessage(manager);
		render(<Toaster toastManager={manager} />);
		// Capture the id through an outer `let` — React 19's `act()` returns a
		// Thenable for the callback's value, so `const id = act(() => …)` would
		// hand a Promise (not the string id) to `message.update`.
		let id = "";
		act(() => {
			id = message.loading({ title: "Uploading…", timeout: 0 });
		});
		act(() => {
			message.update(id, { title: "Upload complete", type: "success", timeout: 5000 });
		});
		expect(screen.getByText("Upload complete")).toBeTruthy();
		expect(screen.queryByText("Uploading…")).toBeNull();
	});

	it("resolves a promise toast to its success state (feature 18)", async () => {
		const manager = createToastManager();
		const message = createToastMessage(manager);
		render(<Toaster toastManager={manager} />);
		const deferred = new Promise<void>((resolve) => {
			window.setTimeout(resolve, 50);
		});
		act(() => {
			void message.promise(deferred, {
				loading: "Saving…",
				success: "Saved",
				error: "Failed",
			});
		});
		expect(screen.getByText("Saving…")).toBeTruthy();
		await waitFor(() => {
			expect(screen.getByText("Saved")).toBeTruthy();
		});
	}, 5000);

	it("toastA11yProps maps type to role/priority (improvement 10)", () => {
		expect(toastA11yProps("error")).toEqual({ role: "alert", priority: "high", label: "Error" });
		expect(toastA11yProps("success")).toEqual({ role: "status", priority: "low", label: "Notification" });
	});

	it("exports zod schemas for type + position (improvement 1/5, rule 13)", () => {
		expect(toastTypeSchema.options).toEqual(["success", "info", "warning", "error", "loading"]);
		expect(toastPositionSchema.options).toEqual(["bottom-right", "bottom-left", "bottom-center", "top-right", "top-left", "top-center"]);
		expect(toastTypeSchema.safeParse("bogus").success).toBe(false);
		expect(toastPositionSchema.parse("top-left")).toBe("top-left");
	});

	it("anchors the viewport + card per the position prop (feature 11)", () => {
		const manager = createToastManager();
		const message = createToastMessage(manager);
		render(<Toaster toastManager={manager} position="top-left" />);
		act(() => {
			message.success({ title: "Anchored" });
		});
		const viewport = document.querySelector("[data-slot='toast-viewport']");
		expect(viewport?.className).toContain("top-4");
		expect(viewport?.className).toContain("sm:start-4");
		expect(viewport?.className).toContain("sm:end-auto");
		// The card anchors to the viewport's top edge (grows downward into view).
		const card = document.querySelector("[data-slot='toast']");
		expect(card?.className).toContain("top-0");
	});
});
