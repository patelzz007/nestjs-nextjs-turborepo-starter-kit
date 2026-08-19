import { cn } from "@workspace/ui/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

const notFoundContentVariants = cva("flex min-h-[50vh] flex-col items-center justify-center gap-5 px-6 py-16 text-center", {
	variants: {
		variant: {
			default: "",
		},
		size: {
			default: "",
			sm: "gap-4 py-12",
		},
		state: {
			default: "",
			loading: "opacity-60",
			disabled: "opacity-50",
			error: "",
		},
	},
	defaultVariants: {
		variant: "default",
		size: "default",
		state: "default",
	},
});

/**
 * Shared, presentational 404 content — every string arrives via props (rules 9–11).
 */
export interface NotFoundContentProps extends VariantProps<typeof notFoundContentVariants> {
	readonly code: string;
	readonly title: string;
	readonly message: string;
	/** The app-supplied "back" link element (e.g. a Next.js `Link`). */
	readonly backLink: React.ReactNode;
	readonly className?: string;
}

export const NotFoundContent = React.forwardRef<HTMLDivElement, NotFoundContentProps>(function NotFoundContent(
	{ code, title, message, backLink, className, variant, size, state },
	ref,
): React.JSX.Element {
	return (
		<div ref={ref} className={cn(notFoundContentVariants({ variant, size, state }), className)}>
			<p className="font-mono text-6xl font-semibold tracking-tight text-muted-foreground/25">{code}</p>
			<div className="space-y-1.5">
				<h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
				<p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">{message}</p>
			</div>
			{backLink}
		</div>
	);
});

export { notFoundContentVariants };
