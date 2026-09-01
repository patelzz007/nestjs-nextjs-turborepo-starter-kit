import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { Separator } from "@workspace/ui/components/display/separator";
import { cn } from "@workspace/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const buttonGroupVariants = cva(
	"flex w-fit items-stretch *:focus-visible:relative *:focus-visible:z-10 has-[>[data-slot=button-group]]:gap-2 has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-e-md [&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit [&>input]:flex-1",
	{
		variants: {
			orientation: {
				horizontal:
					"*:data-slot:rounded-e-none [&>[data-slot]:not(:has(~[data-slot]))]:rounded-e-md! [&>[data-slot]~[data-slot]]:rounded-s-none [&>[data-slot]~[data-slot]]:border-s-0",
				vertical:
					"flex-col *:data-slot:rounded-b-none [&>[data-slot]:not(:has(~[data-slot]))]:rounded-b-md! [&>[data-slot]~[data-slot]]:rounded-t-none [&>[data-slot]~[data-slot]]:border-t-0",
			},
		},
		defaultVariants: {
			orientation: "horizontal",
		},
	},
);

const ButtonGroup = React.forwardRef<HTMLDivElement, React.ComponentProps<"div"> & VariantProps<typeof buttonGroupVariants>>(function ButtonGroup(
	{ className, orientation, ...props },
	ref,
): React.JSX.Element {
	return <div ref={ref} role="group" data-slot="button-group" data-orientation={orientation} className={cn(buttonGroupVariants({ orientation }), className)} {...props} />;
});

const ButtonGroupText = React.forwardRef<HTMLDivElement, useRender.ComponentProps<"div">>(function ButtonGroupText({ className, render, ...props }, ref): React.JSX.Element {
	return useRender({
		ref,
		defaultTagName: "div",
		props: mergeProps<"div">(
			{
				className: cn(
					"flex items-center gap-2 rounded-md border bg-muted px-2.5 text-sm font-medium shadow-xs [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
					className,
				),
			},
			props,
		),
		render,
		state: {
			slot: "button-group-text",
		},
	});
});

const ButtonGroupSeparator = React.forwardRef<HTMLDivElement, React.ComponentProps<typeof Separator>>(function ButtonGroupSeparator(
	{ className, orientation = "vertical", ...props },
	ref,
): React.JSX.Element {
	return (
		<Separator
			ref={ref}
			data-slot="button-group-separator"
			orientation={orientation}
			className={cn("relative self-stretch bg-input data-horizontal:mx-px data-horizontal:w-auto data-vertical:my-px data-vertical:h-auto", className)}
			{...props}
		/>
	);
});

export { ButtonGroup, ButtonGroupSeparator, ButtonGroupText, buttonGroupVariants };
