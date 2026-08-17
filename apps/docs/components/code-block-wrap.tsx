"use client";

import { WrapText } from "lucide-react";
import { useCallback, useState, type ComponentProps, type ReactNode } from "react";

import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";

import { cn } from "@workspace/ui/lib/utils";

/** The wrap-toggle button shown next to the copy button in the action bar. */
function WrapToggleButton({ wrapped, onToggle }: { readonly wrapped: boolean; readonly onToggle: () => void }): React.JSX.Element {
	return (
		<button
			type="button"
			aria-pressed={wrapped}
			aria-label={wrapped ? "Disable word wrap" : "Enable word wrap"}
			title={wrapped ? "Disable word wrap" : "Enable word wrap"}
			onClick={onToggle}
			className="hover:bg-fd-accent hover:text-fd-accent-foreground data-pressed:bg-fd-accent data-pressed:text-fd-accent-foreground inline-flex size-6 items-center justify-center rounded-md transition-colors">
			<WrapText className="size-4" />
		</button>
	);
}

/**
 * The official Fumadocs `CodeBlock` (copy button, optional title bar) with one
 * extra affordance: a word-wrap toggle in the action bar. Long lines that would
 * otherwise scroll horizontally can be soft-wrapped on demand. The `pre`
 * element in `mdx-components.tsx` maps to this component.
 */
export function CodeBlockWithWrap(props: ComponentProps<"pre">): React.JSX.Element {
	const [wrapped, setWrapped] = useState(false);

	const toggleWrap = useCallback((): void => {
		setWrapped((previous) => !previous);
	}, []);

	const renderActions = useCallback(
		({ className, children }: { readonly className?: string; readonly children?: ReactNode }): ReactNode => (
			<div className={className}>
				<WrapToggleButton wrapped={wrapped} onToggle={toggleWrap} />
				{children}
			</div>
		),
		[wrapped, toggleWrap],
	);

	return (
		<CodeBlock {...props} className={cn(props.className, wrapped && "code-wrap")} Actions={renderActions}>
			<Pre>{props.children}</Pre>
		</CodeBlock>
	);
}
