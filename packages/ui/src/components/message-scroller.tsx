"use client";

import { MessageScroller as MessageScrollerPrimitive, useMessageScroller, useMessageScrollerScrollable, useMessageScrollerVisibility } from "@shadcn/react/message-scroller";
import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/core/utils";
import { ArrowDownIcon } from "lucide-react";
import * as React from "react";

/** Pure context provider — renders no DOM element of its own, so it has no ref to forward. */
function MessageScrollerProvider(props: React.ComponentProps<typeof MessageScrollerPrimitive.Provider>): React.JSX.Element {
	return <MessageScrollerPrimitive.Provider {...props} />;
}

const MessageScroller = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof MessageScrollerPrimitive.Root>>(function MessageScroller(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return (
		<MessageScrollerPrimitive.Root
			ref={ref}
			data-slot="message-scroller"
			className={cn("group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden", className)}
			{...props}
		/>
	);
});

const MessageScrollerViewport = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof MessageScrollerPrimitive.Viewport>>(function MessageScrollerViewport(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return (
		<MessageScrollerPrimitive.Viewport
			ref={ref}
			data-slot="message-scroller-viewport"
			className={cn(
				"size-full min-h-0 min-w-0 scroll-fade-b scrollbar-thin scrollbar-gutter-stable overflow-y-auto overscroll-contain contain-content data-autoscrolling:scrollbar-thumb-transparent data-autoscrolling:scrollbar-track-transparent",
				className,
			)}
			{...props}
		/>
	);
});

const MessageScrollerContent = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof MessageScrollerPrimitive.Content>>(function MessageScrollerContent(
	{ className, ...props },
	ref,
): React.JSX.Element {
	return <MessageScrollerPrimitive.Content ref={ref} data-slot="message-scroller-content" className={cn("flex h-max min-h-full flex-col gap-8", className)} {...props} />;
});

const MessageScrollerItem = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof MessageScrollerPrimitive.Item>>(function MessageScrollerItem(
	{ className, scrollAnchor = false, ...props },
	ref,
): React.JSX.Element {
	return (
		<MessageScrollerPrimitive.Item
			ref={ref}
			data-slot="message-scroller-item"
			scrollAnchor={scrollAnchor}
			// Off-screen items skip layout; the placeholder height is a 10rem estimate (spacing 40).
			className={cn("min-w-0 shrink-0 [contain-intrinsic-size:auto_--spacing(40)] [content-visibility:auto]", className)}
			{...props}
		/>
	);
});

type MessageScrollerButtonProps = React.ComponentPropsWithoutRef<typeof MessageScrollerPrimitive.Button> &
	Pick<React.ComponentProps<typeof Button>, "variant" | "size"> & {
		/** Accessible name of the button (e.g. "Scroll to latest message") — supplied by the caller, never hardcoded. */
		readonly label: string;
	};

const MessageScrollerButton = React.forwardRef<HTMLButtonElement, MessageScrollerButtonProps>(function MessageScrollerButton(
	{ direction = "end", className, children, render, variant = "secondary", size = "icon-sm", label, ...props },
	ref,
): React.JSX.Element {
	const defaultRender = React.useMemo((): React.JSX.Element => <Button variant={variant} size={size} />, [variant, size]);

	return (
		<MessageScrollerPrimitive.Button
			ref={ref}
			data-slot="message-scroller-button"
			data-direction={direction}
			data-variant={variant}
			data-size={size}
			direction={direction}
			aria-label={label}
			className={cn(
				"absolute inset-s-1/2 -translate-x-1/2 border-border bg-background text-foreground transition-[translate,scale,opacity] duration-200 hover:bg-muted hover:text-foreground data-[active=false]:pointer-events-none data-[active=false]:scale-95 data-[active=false]:opacity-0 data-[active=false]:duration-400 data-[active=false]:ease-(--ease-emphasized-exit) data-[active=true]:translate-y-0 data-[active=true]:scale-100 data-[active=true]:opacity-100 data-[active=true]:ease-(--ease-emphasized-enter) data-[direction=end]:bottom-4 data-[direction=end]:data-[active=false]:translate-y-full data-[direction=start]:top-4 data-[direction=start]:data-[active=false]:-translate-y-full rtl:translate-x-1/2 data-[direction=start]:[&_svg]:rotate-180",
				className,
			)}
			render={render ?? defaultRender}
			{...props}>
			{children ?? <ArrowDownIcon aria-hidden="true" />}
		</MessageScrollerPrimitive.Button>
	);
});

export {
	type MessageScrollerButtonProps,
	MessageScrollerProvider,
	MessageScroller,
	MessageScrollerViewport,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerButton,
	useMessageScroller,
	useMessageScrollerScrollable,
	useMessageScrollerVisibility,
};
