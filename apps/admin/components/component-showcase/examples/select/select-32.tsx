import type * as React from "react";
import { ArchiveIcon, FileTextIcon, ImageIcon } from "lucide-react";
import { Field } from "@workspace/ui/components/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";

interface Category {
	readonly value: string;
	readonly label: string;
	readonly icon: React.JSX.Element;
}

const categories: readonly Category[] = [
	{ value: "documents", label: "Documents", icon: <FileTextIcon className="size-4" /> },
	{ value: "images", label: "Images", icon: <ImageIcon className="size-4" /> },
	{ value: "archives", label: "Archives", icon: <ArchiveIcon className="size-4" /> },
];

const DEFAULT_CATEGORY = "documents";

interface CategoryLabelProps {
	readonly category: Category;
}

function CategoryLabel({ category }: CategoryLabelProps): React.JSX.Element {
	return (
		<span className="flex items-center gap-2">
			{category.icon}
			<span>{category.label}</span>
		</span>
	);
}

function formatCategory(value: string): React.ReactNode {
	const category = categories.find((item) => item.value === value);
	return category === undefined ? value : <CategoryLabel category={category} />;
}

export function Select32Example(): React.JSX.Element {
	return (
		<Field className="max-w-xs">
			<Select defaultValue={DEFAULT_CATEGORY} items={categories}>
				<SelectTrigger className="w-[200px]">
					<SelectValue formatValue={formatCategory} />
				</SelectTrigger>
				<SelectContent alignItemWithTrigger={false}>
					<SelectGroup>
						{categories.map((category) => (
							<SelectItem key={category.value} value={category.value}>
								<CategoryLabel category={category} />
							</SelectItem>
						))}
					</SelectGroup>
				</SelectContent>
			</Select>
		</Field>
	);
}
