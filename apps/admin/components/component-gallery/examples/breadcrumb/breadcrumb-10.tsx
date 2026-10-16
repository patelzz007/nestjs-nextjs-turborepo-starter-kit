import * as React from "react";
import { HouseIcon } from "lucide-react";
import { Frame, FramePanel } from "@workspace/ui/components/frame";

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@workspace/ui/components/breadcrumb";
import { BREADCRUMB_SAMPLE_HREF } from "@/components/component-gallery/examples/breadcrumb/breadcrumb-sample";

export function Breadcrumb10Example(): React.JSX.Element {
	return (
		<Frame>
			<FramePanel className="gap-2 px-3! py-2!">
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink href={BREADCRUMB_SAMPLE_HREF} className="flex items-center gap-1.5">
								<HouseIcon className="size-4" aria-hidden="true" />
								Home
							</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbLink href={BREADCRUMB_SAMPLE_HREF}>Products</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbPage className="font-semibold">Checkout</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</FramePanel>
		</Frame>
	);
}
