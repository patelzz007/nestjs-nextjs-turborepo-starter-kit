import * as React from "react";
import { ChevronRightIcon, HouseIcon, LayoutGridIcon, SettingsIcon } from "lucide-react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@workspace/ui/components/breadcrumb";
import { Button } from "@workspace/ui/components/button";
import { BREADCRUMB_SAMPLE_HREF } from "@/components/component-gallery/examples/breadcrumb/breadcrumb-sample";

export function Breadcrumb14Example(): React.JSX.Element {
	return (
		<Breadcrumb>
			<BreadcrumbList className="sm:gap-1">
				<BreadcrumbItem>
					<BreadcrumbLink render={<Button variant="ghost" size="sm" />} href={BREADCRUMB_SAMPLE_HREF}>
						<HouseIcon />
						Home
					</BreadcrumbLink>
				</BreadcrumbItem>

				<BreadcrumbSeparator>
					<ChevronRightIcon />
				</BreadcrumbSeparator>

				<BreadcrumbItem>
					<BreadcrumbLink href={BREADCRUMB_SAMPLE_HREF} render={<Button variant="ghost" size="sm" />}>
						<LayoutGridIcon />
						Workspace
					</BreadcrumbLink>
				</BreadcrumbItem>

				<BreadcrumbSeparator>
					<ChevronRightIcon />
				</BreadcrumbSeparator>

				<BreadcrumbItem>
					<BreadcrumbPage>
						<Button variant="secondary" size="sm">
							<SettingsIcon />
							Settings
						</Button>
					</BreadcrumbPage>
				</BreadcrumbItem>
			</BreadcrumbList>
		</Breadcrumb>
	);
}
