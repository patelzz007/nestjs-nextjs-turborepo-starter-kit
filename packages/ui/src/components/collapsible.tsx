"use client";

import { Collapsible as CollapsiblePrimitive } from "@base-ui/react/collapsible";
import * as React from "react";

/**
 * Root — owns the open state. Controlled with `open` / `onOpenChange`, or
 * uncontrolled with `defaultOpen` (base-ui's own controlled pair).
 */
const Collapsible = React.forwardRef<HTMLDivElement, CollapsiblePrimitive.Root.Props>(function Collapsible(props, ref): React.JSX.Element {
	return <CollapsiblePrimitive.Root ref={ref} data-slot="collapsible" {...props} />;
});

/** The button that shows and hides the panel; carries `aria-expanded`. Swap its element through `render`. */
const CollapsibleTrigger = React.forwardRef<HTMLButtonElement, CollapsiblePrimitive.Trigger.Props>(function CollapsibleTrigger(props, ref): React.JSX.Element {
	return <CollapsiblePrimitive.Trigger ref={ref} data-slot="collapsible-trigger" {...props} />;
});

/** The panel, its height animated as it opens and closes. Renders nothing while closed. */
const CollapsibleContent = React.forwardRef<HTMLDivElement, CollapsiblePrimitive.Panel.Props>(function CollapsibleContent(props, ref): React.JSX.Element {
	return <CollapsiblePrimitive.Panel ref={ref} data-slot="collapsible-content" {...props} />;
});

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
