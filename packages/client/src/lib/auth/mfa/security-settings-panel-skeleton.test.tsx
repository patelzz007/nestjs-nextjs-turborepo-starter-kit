// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SIGNED_IN_DEVICES_SKELETON_ROWS } from "../sessions/signed-in-devices-skeleton";
import { SecuritySettingsPanelSkeleton } from "./security-settings-panel-skeleton";

/** The panel's sections: email verification, change password, two-factor, signed-in devices, MFA recovery. */
const PANEL_SECTIONS = 5;

afterEach((): void => {
	cleanup();
});

describe("SecuritySettingsPanelSkeleton", () => {
	it("draws one card per section of the panel, in its two-column grid", (): void => {
		const { container } = render(<SecuritySettingsPanelSkeleton />);

		expect(container.querySelector('[data-slot="security-settings-panel-skeleton"]')?.className).toContain("lg:grid-cols-2");
		expect(container.querySelectorAll('[data-slot="security-section-skeleton"]')).toHaveLength(PANEL_SECTIONS);
	});

	it("draws the signed-in devices section with the device list's own row silhouette", (): void => {
		const { container } = render(<SecuritySettingsPanelSkeleton />);

		expect(container.querySelector('[data-slot="signed-in-devices-skeleton"]')?.children).toHaveLength(SIGNED_IN_DEVICES_SKELETON_ROWS);
	});

	it("is bones only — it announces nothing itself, so a route wraps it in one region", (): void => {
		const { container } = render(<SecuritySettingsPanelSkeleton />);

		expect(container.querySelector('[role="status"]')).toBeNull();
		expect(container.querySelectorAll('[data-slot="form-skeleton"]').length).toBeGreaterThan(0);
	});
});
