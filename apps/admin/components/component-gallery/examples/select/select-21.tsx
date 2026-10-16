"use client";

import type * as React from "react";
import { useCallback, useState } from "react";

import { Field } from "@workspace/ui/components/field";
import { Select, SelectClear, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

interface Framework {
	readonly value: string;
	readonly label: string;
}

const frameworks: readonly Framework[] = [
	{ value: "next", label: "Next.js" },
	{ value: "svelte", label: "SvelteKit" },
	{ value: "nuxt", label: "Nuxt.js" },
	{ value: "remix", label: "Remix" },
	{ value: "astro", label: "Astro" },
];

export function Select21Example(): React.JSX.Element {
	const [value, setValue] = useState<string | null>(null);

	const handleValueChange = useCallback((next: string | null): void => {
		setValue(next);
	}, []);
	const handleClear = useCallback((): void => {
		setValue(null);
	}, []);

	return (
		<Field className="max-w-xs">
			<Select value={value} onValueChange={handleValueChange} items={frameworks}>
				<SelectTrigger className={value === null ? undefined : "[&>svg:last-child]:hidden!"}>
					<SelectValue placeholder="Select framework" />
					{value === null ? null : <SelectClear onClear={handleClear} />}
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					{frameworks.map((framework) => (
						<SelectItem key={framework.value} value={framework.value}>
							{framework.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</Field>
	);
}
