import * as React from "react";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@workspace/ui/components/dialog";
import { Field } from "@workspace/ui/components/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

const items = [
	{ label: "Select a fruit", value: null },
	{ label: "Apple", value: "apple" },
	{ label: "Banana", value: "banana" },
	{ label: "Blueberry", value: "blueberry" },
	{ label: "Grapes", value: "grapes" },
	{ label: "Pineapple", value: "pineapple" },
];

export function Select11Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<Dialog>
				<DialogTrigger render={<Button>Open Dialog</Button>} />
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Select Example</DialogTitle>
						<DialogDescription>Use the select below to choose a fruit.</DialogDescription>
					</DialogHeader>
					<Select items={items}>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent alignItemWithTrigger={false}>
							<SelectGroup>
								{items.map((item) => (
									<SelectItem key={item.value} value={item.value}>
										{item.label}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</DialogContent>
			</Dialog>
		</Field>
	);
}
