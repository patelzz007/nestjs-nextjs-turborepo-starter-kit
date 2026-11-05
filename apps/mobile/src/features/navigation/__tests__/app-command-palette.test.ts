import HouseIcon from "lucide-react-native/icons/house";
import ShieldCheckIcon from "lucide-react-native/icons/shield-check";

import type { CommandPaletteGroup } from "@workspace/ui-native/components/command-palette";
import { commandGroupsOf } from "../app-command-palette";
import { drawerGroupsFor, type DrawerGroup, type DrawerScreen } from "../drawer-destinations";
import { NAVIGATION_LABELS } from "../navigation-labels";

/** The menu as a session without capabilities sees it: the tabs, then Account, Preferences, Rewards, Documents. */
const GROUPS: readonly DrawerGroup[] = drawerGroupsFor({ capabilities: [], enabledFeatureFlags: [] });

describe("commandGroupsOf", () => {
	it("leads with the tabs on neutral tiles, then the drawer's sections in their tones, each named and described by its screen", () => {
		const groups = commandGroupsOf(NAVIGATION_LABELS.en, GROUPS, jest.fn());

		expect(groups.map((group: CommandPaletteGroup): string => group.title)).toEqual(["Go to", "Account", "Preferences", "Rewards", "Documents"]);
		expect(groups.at(0)?.items.every((item): boolean => item.tone === "neutral")).toBe(true);
		expect(groups.at(1)?.items.at(0)).toMatchObject({ label: "Security", tone: "blue", icon: ShieldCheckIcon, testID: "command-security" });
		expect(groups.at(1)?.items.at(0)?.description).toBe(NAVIGATION_LABELS.en.headings.security.subtitle);
	});

	it("opens a command's screen", () => {
		const open = jest.fn<undefined, [DrawerScreen]>();
		const groups = commandGroupsOf(NAVIGATION_LABELS.en, GROUPS, open);

		groups.at(1)?.items.at(0)?.onSelect();
		expect(open).toHaveBeenCalledWith(expect.objectContaining({ route: "/settings/security", isTab: false }));
	});

	it("names the tabs' group in the language on screen", () => {
		expect(commandGroupsOf(NAVIGATION_LABELS.ms, GROUPS, jest.fn()).at(0)?.title).toBe("Pergi ke");
		expect(commandGroupsOf(NAVIGATION_LABELS.en, GROUPS, jest.fn()).at(0)?.items.at(0)?.icon).toBe(HouseIcon);
	});
});
