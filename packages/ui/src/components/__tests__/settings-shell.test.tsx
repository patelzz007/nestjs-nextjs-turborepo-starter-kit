// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { SettingsSectionHeader, SettingsSectionHeaderSkeleton, SettingsShell, type SettingsLinkProps, type SettingsNavGroup } from "@workspace/ui/components/settings-shell";

afterEach((): void => {
	cleanup();
});

const GROUPS: readonly SettingsNavGroup[] = [
	{
		id: "workspace",
		label: "Workspace",
		items: [
			{ id: "profile", label: "Business profile", href: "/settings" },
			{ id: "team", label: "Team & permissions", href: "/settings/team", badge: 2 },
		],
	},
	{ id: "empty", label: "Empty", items: [] },
];

function TestLink({ href, children, ...props }: SettingsLinkProps & { readonly href: string }): React.JSX.Element {
	return (
		<a href={href} {...props}>
			{children}
		</a>
	);
}

function renderLink(href: string): React.ReactElement<SettingsLinkProps> {
	return <TestLink href={href} />;
}

describe("SettingsShell", () => {
	it("draws the title, the grouped sections and the open one's content", () => {
		render(
			<SettingsShell title="Settings" description="Manage your business." groups={GROUPS} activeItemId="team" renderLink={renderLink} navLabel="Settings sections">
				<p>section body</p>
			</SettingsShell>,
		);

		expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeTruthy();
		const nav = screen.getByRole("navigation", { name: "Settings sections" });
		expect(within(nav).getByRole("list", { name: "Workspace" })).toBeTruthy();
		expect(within(nav).queryByText("Empty")).toBeNull();
		expect(screen.getByText("section body")).toBeTruthy();
	});

	it("marks only the open section current, and shows a waiting count", () => {
		render(
			<SettingsShell title="Settings" description="d" groups={GROUPS} activeItemId="team" renderLink={renderLink} navLabel="Sections">
				<p>body</p>
			</SettingsShell>,
		);

		const team = screen.getByRole("link", { name: /Team & permissions/ });
		expect(team.getAttribute("aria-current")).toBe("page");
		expect(team.getAttribute("href")).toBe("/settings/team");
		expect(within(team).getByText("2")).toBeTruthy();
		expect(screen.getByRole("link", { name: "Business profile" }).getAttribute("aria-current")).toBeNull();
	});
});

describe("SettingsSectionHeader", () => {
	it("names the section and carries its action", () => {
		render(<SettingsSectionHeader title="Team & permissions" description="Who can do what." action={<button type="button">Invite teammate</button>} />);

		expect(screen.getByRole("heading", { level: 2, name: "Team & permissions" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Invite teammate" })).toBeTruthy();
	});
});

describe("SettingsSectionHeaderSkeleton", () => {
	it("draws the header's bones, with the action only when the section has one", () => {
		const { container, rerender } = render(<SettingsSectionHeaderSkeleton />);

		expect(container.querySelectorAll('[data-slot="settings-section-header-skeleton"]')).toHaveLength(1);
		expect(container.querySelectorAll('[data-slot="settings-section-action-skeleton"]')).toHaveLength(0);

		rerender(<SettingsSectionHeaderSkeleton withAction />);
		expect(container.querySelectorAll('[data-slot="settings-section-action-skeleton"]')).toHaveLength(1);
	});
});
