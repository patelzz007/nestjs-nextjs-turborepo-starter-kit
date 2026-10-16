"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { z } from "zod";

import { cn } from "@workspace/ui/lib/core/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { Field } from "@workspace/ui/components/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@workspace/ui/components/input-group";

const HttpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

type HttpMethod = z.infer<typeof HttpMethodSchema>;

const HTTP_METHODS: readonly HttpMethod[] = HttpMethodSchema.options;

const HTTP_METHOD_COLORS: Readonly<Record<HttpMethod, string>> = {
	GET: "text-emerald-600 dark:text-emerald-400",
	POST: "text-blue-500",
	PUT: "text-amber-500",
	PATCH: "text-violet-500",
	DELETE: "text-destructive",
};

export function InputGroup36Example(): React.JSX.Element {
	const [method, setMethod] = useState<HttpMethod>("GET");

	// Each menu item carries its method in `data-value`; the schema narrows it back to a method.
	const handleSelect = useCallback((event: React.MouseEvent<HTMLDivElement>): void => {
		const parsed = HttpMethodSchema.safeParse(event.currentTarget.dataset.value);
		if (parsed.success) {
			setMethod(parsed.data);
		}
	}, []);

	return (
		<Field className="max-w-md">
			<InputGroup>
				<InputGroupAddon>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={<InputGroupButton variant="ghost" className={cn("gap-1.5 font-mono text-xs", HTTP_METHOD_COLORS[method])} aria-label={`HTTP method: ${method}`} />}>
							{method}
							<ChevronDownIcon className="size-3 opacity-60" aria-hidden="true" />
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-28">
							<DropdownMenuGroup>
								{HTTP_METHODS.map((item) => (
									<DropdownMenuItem key={item} data-value={item} className={cn("font-mono text-xs font-semibold", HTTP_METHOD_COLORS[item])} onClick={handleSelect}>
										{item}
									</DropdownMenuItem>
								))}
							</DropdownMenuGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				</InputGroupAddon>

				<InputGroupInput defaultValue="/v1/agents/run" className="font-mono text-xs" aria-label="API endpoint path" />

				<InputGroupAddon align="inline-end">
					<InputGroupButton size="xs" aria-label="Send request">
						Send
					</InputGroupButton>
				</InputGroupAddon>
			</InputGroup>
		</Field>
	);
}
