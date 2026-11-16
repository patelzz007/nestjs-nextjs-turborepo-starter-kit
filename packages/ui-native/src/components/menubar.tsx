// A row of menus for an editor's toolbar (the web kit's `Menubar`): File,
// Edit, View… Each menu is a DropdownMenu (its items rise in a bottom sheet:
// icons, shortcuts, checkbox and radio items, groups, submenus), its trigger a
// quiet button in one bordered strip.
//
// Data-agnostic: `menus` in, each with its own `onSelect(value)`. The ref
// reaches the strip.

import { cva } from "class-variance-authority";
import * as React from "react";
import { ScrollView, View, type ViewInstance } from "react-native";

import { cn } from "../lib/cn";
import type { OptionSelectHandler } from "./bottom-sheet";
import { DropdownMenu, type DropdownMenuItemData } from "./dropdown-menu";

export const menubarVariants = cva("flex-row items-center", {
	variants: {
		/** `outline`: a bordered strip; `plain`: the triggers alone. */
		variant: { outline: "self-start rounded-lg border border-border bg-card p-0.5", plain: "" },
	},
	defaultVariants: { variant: "outline" },
});

export type MenubarVariant = "outline" | "plain";

export interface MenubarMenu {
	readonly key: string;
	/** The trigger's text, and the sheet's title. */
	readonly label: string;
	readonly items: readonly DropdownMenuItemData<string>[];
	readonly onSelect: OptionSelectHandler<string>;
	/** Above the menu's rows. */
	readonly header?: React.ReactNode;
}

export interface MenubarProps {
	readonly menus: readonly MenubarMenu[];
	readonly variant?: MenubarVariant | undefined;
	/** The strip's name for screen readers. Default "Menu bar". */
	readonly accessibilityLabel?: string | undefined;
	/** Extra classes for the strip, merged last. */
	readonly className?: string | undefined;
	readonly testID?: string | undefined;
}

export const Menubar = React.memo(
	React.forwardRef<ViewInstance, MenubarProps>(function Menubar({ menus, variant = "outline", accessibilityLabel = "Menu bar", className, testID }, ref): React.JSX.Element {
		return (
			<View ref={ref} accessibilityRole="menubar" accessibilityLabel={accessibilityLabel} testID={testID} className={cn(menubarVariants({ variant }), className)}>
				<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="items-center gap-0.5">
					{menus.map((menu: MenubarMenu): React.JSX.Element => (
						<DropdownMenu
							key={menu.key}
							label={menu.label}
							items={menu.items}
							onSelect={menu.onSelect}
							header={menu.header}
							variant="ghost"
							size="sm"
							hideChevron
							testID={testID === undefined ? undefined : `${testID}-${menu.key}`}
						/>
					))}
				</ScrollView>
			</View>
		);
	}),
);
