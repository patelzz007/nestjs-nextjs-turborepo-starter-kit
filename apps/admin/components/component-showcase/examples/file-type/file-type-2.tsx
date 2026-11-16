import * as React from "react";
import { FileType, type FileTypeName, type FileTypeVariant } from "@workspace/ui/components/file-type";

const variants: readonly FileTypeVariant[] = ["outline", "solid", "light", "mono"];

// The same types in every row, so the variant is the only thing that changes.
const types: readonly FileTypeName[] = ["pdf", "docx", "xlsx", "jpg", "zip"];

export function FileType2Example(): React.JSX.Element {
	return (
		<div className="mx-auto flex w-fit flex-col gap-5">
			{variants.map((variant) => (
				<div key={variant} className="flex flex-col gap-2.5">
					<span className="text-xs text-muted-foreground capitalize">{variant}</span>
					<div className="flex gap-4">
						{types.map((type: FileTypeName): React.JSX.Element => (
							<FileType key={type} type={type} variant={variant} />
						))}
					</div>
				</div>
			))}
		</div>
	);
}
