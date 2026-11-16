import type * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

interface Font {
	readonly value: string;
	readonly label: string;
	readonly className: string;
}

const fonts: readonly Font[] = [
	{ value: "sans", label: "Inter", className: "font-sans" },
	{ value: "mono", label: "Mono", className: "font-mono" },
	{ value: "serif", label: "Serif", className: "font-serif" },
];

const DEFAULT_FONT = "sans";

function formatFont(value: string): React.ReactNode {
	const font = fonts.find((item) => item.value === value);
	return font === undefined ? value : <span className={font.className}>{font.label}</span>;
}

export function Select31Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<Select defaultValue={DEFAULT_FONT} items={fonts}>
				<SelectTrigger className="w-[200px]">
					<SelectValue formatValue={formatFont} />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					<SelectGroup>
						{fonts.map((font) => (
							<SelectItem key={font.value} value={font.value}>
								<span className={font.className}>{font.label}</span>
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</Field>
	);
}
