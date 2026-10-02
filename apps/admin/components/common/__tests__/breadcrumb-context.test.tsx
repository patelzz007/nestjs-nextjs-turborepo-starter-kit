// @vitest-environment jsdom

import { cleanup, render, renderHook } from "@testing-library/react";
import { Settings } from "lucide-react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as React from "react";

import {
	BreadcrumbItemSchema,
	breadcrumbStatusSchema,
	createBreadcrumbContext,
	type BreadcrumbItem,
	type BreadcrumbStatus,
} from "@workspace/ui/components/navigation/breadcrumb-context";

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

/** Test resolver: `/settings` resolves to a two-crumb trail, everything else is empty. */
function resolve(pathname: string): readonly BreadcrumbItem[] {
	if (pathname === "/settings") {
		return [
			{ label: "Settings", href: "/settings", icon: Settings },
			{ label: "General", icon: Settings },
		];
	}
	return [];
}

const { provider: BreadcrumbProvider, useBreadcrumb } = createBreadcrumbContext(resolve);

/** Builds a renderHook wrapper bound to a pathname (fresh provider per test). */
function makeWrapper(pathname: string): ({ children }: { readonly children: React.ReactNode }) => React.JSX.Element {
	return ({ children }): React.JSX.Element => <BreadcrumbProvider pathname={pathname}>{children}</BreadcrumbProvider>;
}

describe("BreadcrumbContext", () => {
	it("resolves the route-derived trail for the pathname (status ready)", () => {
		const { result } = renderHook(() => useBreadcrumb(), { wrapper: makeWrapper("/settings") });

		expect(result.current.status.kind).toBe("ready");
		if (result.current.status.kind === "ready") {
			expect(result.current.status.items.map((item) => item.label)).toEqual(["Settings", "General"]);
			// The final crumb (current page) has no href.
			const lastItem = result.current.status.items[result.current.status.items.length - 1];
			expect(lastItem?.href).toBeUndefined();
		}
	});

	it("resolves to an empty ready trail on routes with no crumbs", () => {
		const { result } = renderHook(() => useBreadcrumb(), { wrapper: makeWrapper("/unknown") });

		expect(result.current.status).toEqual({ kind: "ready", items: [] });
	});

	it("overrides the trail with setItems and restores it with reset (improvement 17)", () => {
		const { result } = renderHook(() => useBreadcrumb(), { wrapper: makeWrapper("/settings") });

		act(() => {
			result.current.setItems([{ label: "Custom", icon: Settings }]);
		});
		let items = result.current.status.kind === "ready" ? result.current.status.items : [];
		expect(items.map((item) => item.label)).toEqual(["Custom"]);

		act(() => {
			result.current.reset();
		});
		items = result.current.status.kind === "ready" ? result.current.status.items : [];
		expect(items.map((item) => item.label)).toEqual(["Settings", "General"]);
	});

	it("marks the trail as errored with setError", () => {
		const { result } = renderHook(() => useBreadcrumb(), { wrapper: makeWrapper("/settings") });

		act(() => {
			result.current.setError("Boom");
		});
		expect(result.current.status).toEqual({ kind: "error", message: "Boom" });
	});

	it("names the final crumb with setTailLabel and clears it with null", () => {
		const { result } = renderHook(() => useBreadcrumb(), { wrapper: makeWrapper("/settings") });

		act(() => {
			result.current.setTailLabel("  Jane Doe  ");
		});
		let items = result.current.status.kind === "ready" ? result.current.status.items : [];
		expect(items.map((item) => item.label)).toEqual(["Settings", "Jane Doe"]);

		act(() => {
			result.current.setTailLabel(null);
		});
		items = result.current.status.kind === "ready" ? result.current.status.items : [];
		expect(items.map((item) => item.label)).toEqual(["Settings", "General"]);
	});

	it("keeps a label a child page sets at its FIRST render (the provider's route resolution never overwrites it)", () => {
		function NamedPage(): React.JSX.Element {
			const { setTailLabel, status } = useBreadcrumb();
			React.useEffect(() => {
				setTailLabel("Jane Doe");
			}, [setTailLabel]);
			return <p>{status.kind === "ready" ? status.items.map((item) => item.label).join(" › ") : status.kind}</p>;
		}

		const { container } = render(
			<BreadcrumbProvider pathname="/settings">
				<NamedPage />
			</BreadcrumbProvider>,
		);

		expect(container.textContent).toBe("Settings › Jane Doe");
	});

	it("scopes labels and overrides to the pathname they were set on", () => {
		function Probe(): React.JSX.Element {
			const { status } = useBreadcrumb();
			return <p>{status.kind === "ready" ? status.items.map((item) => item.label).join(" › ") : status.kind}</p>;
		}
		function Labeller(): null {
			const { setTailLabel } = useBreadcrumb();
			React.useEffect(() => {
				setTailLabel("Jane Doe");
			}, [setTailLabel]);
			return null;
		}

		const { container, rerender } = render(
			<BreadcrumbProvider pathname="/settings">
				<Labeller />
				<Probe />
			</BreadcrumbProvider>,
		);
		expect(container.textContent).toBe("Settings › Jane Doe");

		// Navigating away without the page clearing its label: the label stays behind.
		rerender(
			<BreadcrumbProvider pathname="/unknown">
				<Probe />
			</BreadcrumbProvider>,
		);
		expect(container.textContent).toBe("");
		rerender(
			<BreadcrumbProvider pathname="/settings">
				<Probe />
			</BreadcrumbProvider>,
		);
		expect(container.textContent).toBe("Settings › Jane Doe");
	});

	it("delivers malformed items as an error status instead of rendering them (improvement 1)", () => {
		const { result } = renderHook(() => useBreadcrumb(), { wrapper: makeWrapper("/settings") });

		act(() => {
			// @ts-expect-error — deliberately drop the mandatory icon to exercise the boundary validation
			result.current.setItems([{ label: "Bad" }]);
		});
		expect(result.current.status.kind).toBe("error");
	});

	it("subscribe delivers the current status immediately and returns an unsubscribe (improvements 2/7)", () => {
		const { result } = renderHook(() => useBreadcrumb(), { wrapper: makeWrapper("/settings") });

		const listener = vi.fn();
		const unsubscribe = result.current.subscribe(listener);

		// Immediate delivery with the CURRENT status (shell chrome can diff without another read).
		expect(listener).toHaveBeenCalledTimes(1);
		expect(listener).toHaveBeenCalledWith(result.current.status);

		act(() => {
			result.current.setItems([{ label: "X", icon: Settings }]);
		});
		expect(listener).toHaveBeenCalledTimes(2);

		// Unsubscribing stops delivery — listeners never accumulate (rule 16).
		unsubscribe();
		act(() => {
			result.current.setItems([{ label: "Y", icon: Settings }]);
		});
		expect(listener).toHaveBeenCalledTimes(2);
	});

	it("notifies listeners on route-driven resolution", () => {
		const listener = vi.fn();
		const Probe = (): null => {
			const { subscribe } = useBreadcrumb();
			// `listener` is a stable per-test mock — it is not a reactive dependency,
			// so the compiler lint wants it out of the dep array.
			React.useEffect(() => subscribe(listener), [subscribe]);
			return null;
		};

		const { rerender } = render(
			<BreadcrumbProvider pathname="/settings">
				<Probe />
			</BreadcrumbProvider>,
		);
		// subscribe delivers the current status immediately, then the provider's
		// initial route resolution notifies again (children effects run before
		// parent effects, so the subscribe lands first).
		expect(listener).toHaveBeenCalledTimes(2);

		// Same provider instance, new pathname → re-resolve + notify.
		rerender(
			<BreadcrumbProvider pathname="/">
				<Probe />
			</BreadcrumbProvider>,
		);
		expect(listener).toHaveBeenCalledTimes(3);
	});

	it("exports zod schemas for items and the status union (improvements 4/19)", () => {
		// Item: a missing icon must fail at parse, not render.
		expect(BreadcrumbItemSchema.safeParse({ label: "Bad" }).success).toBe(false);
		expect(BreadcrumbItemSchema.safeParse({ label: "Good", icon: Settings }).success).toBe(true);

		// Status: discriminated union by kind.
		const ready: BreadcrumbStatus = { kind: "ready", items: [{ label: "A", icon: Settings }] };
		expect(breadcrumbStatusSchema.parse(ready).kind).toBe("ready");
		expect(breadcrumbStatusSchema.parse({ kind: "loading" }).kind).toBe("loading");
		expect(breadcrumbStatusSchema.safeParse({ kind: "bogus" }).success).toBe(false);
	});
});
