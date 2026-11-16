import * as React from "react";
import { Field } from "@workspace/ui/components/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

const frontend = [
	{ label: "React", value: "react" },
	{ label: "Vue", value: "vue" },
	{ label: "Angular", value: "angular" },
];

const backend = [
	{ label: "Node.js", value: "nodejs" },
	{ label: "Python", value: "python" },
	{ label: "Go", value: "go" },
];

const allItems = [{ label: "Select a framework", value: null }, ...frontend, ...backend];

export function Select24Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<Select items={allItems}>
				<SelectTrigger>
					<SelectValue />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					<SelectGroup>
						<SelectLabel>Frontend</SelectLabel>
						{frontend.map((item) => (
							<SelectItem key={item.value} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectGroup>
					<SelectSeparator />
					<SelectGroup>
						<SelectLabel>Backend</SelectLabel>
						{backend.map((item) => (
							<SelectItem key={item.value} value={item.value}>
								{item.label}
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</Field>
	);
}
