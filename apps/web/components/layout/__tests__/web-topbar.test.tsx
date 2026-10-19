// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { Gift } from "lucide-react";
import type { BreadcrumbStatus } from "@workspace/ui/components/breadcrumb-context";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CommandPaletteClientOnly from "@/components/layout/command-palette.client-only";
import { WebTopbar } from "@/components/layout/web-topbar";

const READY: BreadcrumbStatus = { kind: "ready", items: [{ label: "Rewards", href: "/dashboard", icon: Gift }] };

/** The shared header is specified in @workspace/client; here only this app's wiring is under test. */
const shellTopbar = vi.hoisted(() => vi.fn<(props: object) => void>());
vi.mock("@workspace/client/lib/features/navigation/shell-topbar", () => ({
	ShellTopbar: (props: object): React.JSX.Element => {
		shellTopbar(props);
		return <header>shell</header>;
	},
}));

vi.mock("@/components/breadcrumb-provider", () => ({
	useWebBreadcrumb: (): { readonly status: BreadcrumbStatus } => ({ status: READY }),
}));

afterEach(() => {
	cleanup();
});

describe("WebTopbar", () => {
	it("hands the shared header this app's breadcrumb trail and its command palette", () => {
		render(<WebTopbar />);

		expect(screen.getByRole("banner").textContent).toBe("shell");
		expect(shellTopbar).toHaveBeenCalledWith({ breadcrumbStatus: READY, commandPalette: CommandPaletteClientOnly });
	});
});
