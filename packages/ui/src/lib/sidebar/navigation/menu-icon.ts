import type { LucideIcon } from "lucide-react";

/** An app's sidebar icon names (the `icon` of its menu JSON) mapped to their components. */
export type MenuIconMap = Readonly<Record<string, LucideIcon>>;

/**
 * The icon for a menu item's `icon` name, from the app's map, or `fallback` when the item names none
 * or one the map does not know (the menu tests keep every name mapped; this only guards a typo).
 */
export function menuIconResolver(icons: MenuIconMap, fallback: LucideIcon): (iconName: string | undefined) => LucideIcon {
	return (iconName: string | undefined): LucideIcon => (iconName === undefined ? fallback : (icons[iconName] ?? fallback));
}
