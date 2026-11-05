import { createElement, type ReactElement } from "react";

import { iconComponent, type IconName } from "@/lib/icons";

export interface DocsIconProps {
	readonly name: IconName;
	readonly size?: number;
	readonly className?: string;
}

/** Glyph size (px) when none is given: the 14px chrome text it sits beside. */
const DEFAULT_SIZE = 16;

/**
 * A registered site icon, decorative (the text beside it names the thing). The component comes from the
 * module-level registry (`ICONS`), so its identity never changes between renders.
 */
export function DocsIcon({ name, size = DEFAULT_SIZE, className }: DocsIconProps): ReactElement {
	return createElement(iconComponent(name), { "aria-hidden": "true", size, className });
}
