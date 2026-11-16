import * as React from "react";
import { FileIcon, FolderIcon, ImageIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup, ButtonGroupSeparator } from "@workspace/ui/components/button-group";

export function ButtonGroup23Example(): React.JSX.Element {
	return (
		<ButtonGroup className="**:data-[slot=button]:border-0">
			<Button aria-label="Files">
				<FileIcon aria-hidden="true" />
				Files
			</Button>
			<ButtonGroupSeparator className="bg-primary/72" />
			<Button aria-label="Folder">
				<FolderIcon aria-hidden="true" />
				Folder
			</Button>
			<ButtonGroupSeparator className="bg-primary/72" />
			<Button aria-label="Trash">
				<ImageIcon aria-hidden="true" />
				Media
			</Button>
		</ButtonGroup>
	);
}
