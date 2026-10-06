import { cleanup, render, screen } from "@testing-library/react";
import { MapPin } from "lucide-react";
import * as React from "react";
import { afterEach, describe, expect, it } from "vitest";

import { StatCard } from "./stat-card";

afterEach((): void => {
	cleanup();
});

describe("StatCard", () => {
	it("shows the label, value and hint, with its icon in a brand tile by default", (): void => {
		render(<StatCard label="Locations" value="3" hint="Primary: Bukit Bintang" icon={<MapPin />} />);

		expect(screen.getByText("Locations")).toBeTruthy();
		expect(screen.getByText("3")).toBeTruthy();
		expect(screen.getByText("Primary: Bukit Bintang")).toBeTruthy();
		expect(document.querySelector('[data-slot="icon-tile"]')?.getAttribute("data-tone")).toBe("brand");
	});

	it("tones its icon tile by what the stat is about", (): void => {
		render(<StatCard label="KYB status" value="Approved" hint="Business verification" icon={<MapPin />} tone="teal" />);

		expect(document.querySelector('[data-slot="icon-tile"]')?.getAttribute("data-tone")).toBe("teal");
	});
});
