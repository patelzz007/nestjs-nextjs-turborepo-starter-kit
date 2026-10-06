// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useWebBreadcrumb, WebBreadcrumbProvider } from "@/components/breadcrumb-provider";
import { WebBreadcrumbTailLabel } from "@/components/breadcrumb-tail-label";
import { rewardDetailPath, ROUTES } from "@/lib/routes";

const { pathnameMock } = vi.hoisted(() => ({
	pathnameMock: vi.fn<() => string>(),
}));

vi.mock("next/navigation", () => ({
	usePathname: (): string => pathnameMock(),
}));

afterEach(() => {
	cleanup();
});

/** Renders the trail's labels joined with " › " so assertions read like the UI. */
function TrailProbe(): React.JSX.Element {
	const { status } = useWebBreadcrumb();
	const text = status.kind === "ready" ? status.items.map((item) => item.label).join(" › ") : status.kind;
	return <p data-testid="trail">{text}</p>;
}

interface PageProps {
	readonly label: string | undefined;
	readonly showLabel: boolean;
}

function Page({ label, showLabel }: PageProps): React.JSX.Element {
	return (
		<WebBreadcrumbProvider>
			{showLabel ? <WebBreadcrumbTailLabel label={label} /> : null}
			<TrailProbe />
		</WebBreadcrumbProvider>
	);
}

function trailText(): string | null {
	return screen.getByTestId("trail").textContent;
}

describe("WebBreadcrumbTailLabel", () => {
	it("names the final crumb after the entity when the label is known at first render", () => {
		pathnameMock.mockReturnValue(rewardDetailPath("reward-1"));
		render(<Page label="Free coffee" showLabel />, { wrapper: UiKitTestProviders });

		expect(trailText()).toBe("Browse Rewards › Free coffee");
	});

	it("keeps the generic label while the entity name is unknown, then applies it", () => {
		pathnameMock.mockReturnValue(rewardDetailPath("reward-1"));
		const { rerender } = render(<Page label={undefined} showLabel />, { wrapper: UiKitTestProviders });
		expect(trailText()).toBe("Browse Rewards › Reward");

		rerender(<Page label="Free coffee" showLabel />);
		expect(trailText()).toBe("Browse Rewards › Free coffee");
	});

	it("ignores a blank label", () => {
		pathnameMock.mockReturnValue(rewardDetailPath("reward-1"));
		render(<Page label="   " showLabel />, { wrapper: UiKitTestProviders });

		expect(trailText()).toBe("Browse Rewards › Reward");
	});

	it("restores the route-derived trail when the page unmounts", () => {
		pathnameMock.mockReturnValue(rewardDetailPath("reward-1"));
		const { rerender } = render(<Page label="Free coffee" showLabel />, { wrapper: UiKitTestProviders });

		rerender(<Page label="Free coffee" showLabel={false} />);
		expect(trailText()).toBe("Browse Rewards › Reward");
	});

	it("never carries a label over to the next page", () => {
		pathnameMock.mockReturnValue(rewardDetailPath("reward-1"));
		const { rerender } = render(<Page label="Free coffee" showLabel />, { wrapper: UiKitTestProviders });

		pathnameMock.mockReturnValue(ROUTES.rewardHub.wallet);
		act(() => {
			rerender(<Page label="Free coffee" showLabel={false} />);
		});
		expect(trailText()).toBe("My Wallet");
	});
});
