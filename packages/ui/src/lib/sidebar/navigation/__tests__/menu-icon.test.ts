import { CircleAlert, FileText, House } from "lucide-react";
import { describe, expect, it } from "vitest";

import { menuIconResolver } from "../menu-icon";

describe("menuIconResolver", () => {
	const resolveIcon = menuIconResolver({ Home: House }, FileText);

	it("finds a mapped icon by its name", () => {
		expect(resolveIcon("Home")).toBe(House);
	});

	it("falls back for an item without an icon or with an unknown name", () => {
		expect(resolveIcon(undefined)).toBe(FileText);
		expect(resolveIcon("Unknown")).toBe(FileText);
		expect(menuIconResolver({}, CircleAlert)("Home")).toBe(CircleAlert);
	});
});
