import * as React from "react";
import { CopyIcon, SearchIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { Button } from "@workspace/ui/components/button";
import { ButtonGroup } from "@workspace/ui/components/button-group";

export function ButtonGroup14Example(): React.JSX.Element {
	return (
		<ButtonGroup orientation="vertical">
			<ButtonGroup orientation="vertical">
				<Button variant="outline" size="icon" aria-label="Search">
					<SearchIcon aria-hidden="true" />
				</Button>
				<Button variant="outline" size="icon" aria-label="Copy">
					<CopyIcon aria-hidden="true" />
				</Button>
				<Button variant="outline" size="icon" aria-label="Share">
					<UploadIcon aria-hidden="true" />
				</Button>
			</ButtonGroup>
			<ButtonGroup>
				<Button variant="outline" size="icon" aria-label="Trash">
					<Trash2Icon aria-hidden="true" />
				</Button>
			</ButtonGroup>
		</ButtonGroup>
	);
}
