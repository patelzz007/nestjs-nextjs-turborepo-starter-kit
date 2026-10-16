import { describe, expect, it } from "vitest";

import { panelSidebarNavItemVariants } from "./panel-nav-variants";
import { sidebarMenuButtonVariants, sidebarMenuSubButtonVariants } from "./variants";

describe("sidebar menu typography", () => {
	it("applies the refined sidebar font styling with subtle tracking and balanced active emphasis", () => {
		expect(sidebarMenuButtonVariants()).toContain("font-[family-name:var(--font-sidebar)]");
		expect(sidebarMenuButtonVariants()).toContain("font-normal");
		expect(sidebarMenuButtonVariants()).toContain("tracking-[0.01em]");
		expect(sidebarMenuSubButtonVariants()).toContain("font-[family-name:var(--font-sidebar)]");
		expect(sidebarMenuSubButtonVariants()).toContain("font-normal");
		expect(sidebarMenuSubButtonVariants()).toContain("tracking-[0.01em]");
		expect(panelSidebarNavItemVariants()).toContain("font-[family-name:var(--font-sidebar)]");
		expect(panelSidebarNavItemVariants()).toContain("font-normal");
		expect(panelSidebarNavItemVariants()).toContain("tracking-[0.01em]");
	});
});
