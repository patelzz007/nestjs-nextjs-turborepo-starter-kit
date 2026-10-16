import * as React from "react";
import { FileTextIcon } from "lucide-react";
import { Frame, FramePanel } from "@workspace/ui/components/frame";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@workspace/ui/components/breadcrumb";
import { BREADCRUMB_SAMPLE_HREF } from "@/components/component-gallery/examples/breadcrumb/breadcrumb-sample";

export function Breadcrumb15Example(): React.JSX.Element {
	return (
		<Frame spacing="sm">
			<FramePanel>
				<Breadcrumb>
					<BreadcrumbList className="gap-3">
						<BreadcrumbItem>
							<BreadcrumbLink href={BREADCRUMB_SAMPLE_HREF} className="flex items-center gap-2 text-foreground">
								<Avatar className="size-6">
									<AvatarImage src="https://github.com/vercel.png" />
									<AvatarFallback>VC</AvatarFallback>
								</Avatar>
							</BreadcrumbLink>
						</BreadcrumbItem>

						<BreadcrumbSeparator className="text-muted-foreground/60">/</BreadcrumbSeparator>

						<BreadcrumbItem>
							<BreadcrumbLink href={BREADCRUMB_SAMPLE_HREF} className="flex items-center gap-3">
								<Avatar className="size-6">
									<AvatarImage src="https://github.com/shadcn.png" className="object-cover" />
									<AvatarFallback>MP</AvatarFallback>
								</Avatar>
								<div className="flex flex-col">
									<span className="leading-tight font-medium text-foreground">shadcn</span>
									<span className="leading-tight text-muted-foreground">ui@shadcn.com</span>
								</div>
							</BreadcrumbLink>
						</BreadcrumbItem>

						<BreadcrumbSeparator className="text-muted-foreground/60">/</BreadcrumbSeparator>

						<BreadcrumbItem>
							<BreadcrumbPage className="flex items-center gap-2.5">
								<span className="flex size-6 items-center justify-center rounded-md bg-tone-blue-soft text-tone-blue">
									<FileTextIcon className="size-3.5" />
								</span>
								<div className="flex flex-col">
									<span className="leading-tight font-medium text-foreground">Document</span>
									<span className="flex items-center gap-1 leading-tight text-muted-foreground">agents.md</span>
								</div>
							</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
			</FramePanel>
		</Frame>
	);
}
