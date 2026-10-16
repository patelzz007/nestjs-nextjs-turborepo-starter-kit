// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { ActiveGalleryComponentProvider, useIsGallerySectionShown } from "@/components/component-gallery/active-gallery-component";

afterEach(() => {
	cleanup();
});

function Probe({ sectionId }: { readonly sectionId: string }): React.JSX.Element {
	return <p>{`${sectionId}: ${useIsGallerySectionShown(sectionId) ? "shown" : "hidden"}`}</p>;
}

describe("useIsGallerySectionShown", () => {
	it("shows every section without a provider", () => {
		render(<Probe sectionId="component-button" />);
		expect(screen.getByText("component-button: shown")).toBeTruthy();
	});

	it("shows only the active section under a provider", () => {
		render(
			<ActiveGalleryComponentProvider sectionId="component-kbd">
				<Probe sectionId="component-kbd" />
				<Probe sectionId="component-button" />
			</ActiveGalleryComponentProvider>,
		);
		expect(screen.getByText("component-kbd: shown")).toBeTruthy();
		expect(screen.getByText("component-button: hidden")).toBeTruthy();
	});
});
