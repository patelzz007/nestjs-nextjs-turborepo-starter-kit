// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PrivacySettingsSections } from "../privacy-settings-sections";

vi.mock("../download-my-data-panel", () => ({ DownloadMyDataPanel: (): React.JSX.Element => <p>download panel</p> }));
vi.mock("../delete-my-account-panel", () => ({ DeleteMyAccountPanel: (): React.JSX.Element => <p>delete panel</p> }));

afterEach((): void => {
	cleanup();
});

describe("PrivacySettingsSections", () => {
	it("gives each privacy panel its own titled section", () => {
		render(<PrivacySettingsSections />);
		expect(screen.getByRole("region", { name: "Your data" }).textContent).toContain("download panel");
		expect(screen.getByRole("region", { name: "Delete my account" }).textContent).toContain("delete panel");
	});
});
