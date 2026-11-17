// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { Gift } from "lucide-react";
import type { BreadcrumbStatus } from "@workspace/ui/components/breadcrumb-context";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CommandPaletteClientOnly from "@/components/layout/command-palette.client-only";
import { WebTopbar } from "@/components/layout/web-topbar";
import { ROUTES } from "@/lib/routes";

const READY: BreadcrumbStatus = { kind: "ready", items: [{ label: "Rewards", href: "/dashboard", icon: Gift }] };

/** What this app hands the shared header. */
interface ShellTopbarProps {
	readonly breadcrumbStatus: BreadcrumbStatus;
	readonly commandPalette: object;
	readonly actions?: React.ReactNode;
	readonly notificationsHref: string;
}

/** The shared header is specified in @workspace/client; here only this app's wiring is under test. */
const shellTopbar = vi.hoisted(() => vi.fn<(props: ShellTopbarProps) => void>());
vi.mock("@workspace/client/lib/features/navigation/shell-topbar", () => ({
	ShellTopbar: (props: ShellTopbarProps): React.JSX.Element => {
		shellTopbar(props);
		return <header>shell{props.actions}</header>;
	},
}));

vi.mock("@/components/breadcrumb-provider", () => ({
	useWebBreadcrumb: (): { readonly status: BreadcrumbStatus } => ({ status: READY }),
}));

/** The tier badge reads the API; here it only has to be the header's action. */
vi.mock("@/contexts/tiers/components/topbar-tier-badge", () => ({
	TopbarTierBadge: (): React.JSX.Element => <span>tier badge</span>,
}));

afterEach(() => {
	cleanup();
});

describe("WebTopbar", () => {
	it("hands the shared header this app's breadcrumb trail, its command palette, the customer's tier and its inbox page", () => {
		render(<WebTopbar />);

		expect(screen.getByRole("banner").textContent).toBe("shelltier badge");
		const [props] = shellTopbar.mock.lastCall ?? [];
		expect(props?.breadcrumbStatus).toBe(READY);
		expect(props?.commandPalette).toBe(CommandPaletteClientOnly);
		expect(props?.notificationsHref).toBe(ROUTES.dashboard.notifications);
	});
});
