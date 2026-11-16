## Installation

The sidebar parts ship with the kit in `packages/ui/src/components/sidebar.tsx` and `packages/ui/src/components/sidebar-context.tsx`; there is nothing to install.

```showcase-example
c-sidebar-1
```

## Usage

```tsx
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarInset,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarTrigger,
} from "@workspace/ui/components/sidebar";
```

```tsx
<SidebarProvider>
	<Sidebar collapsible="icon">
		<SidebarHeader>{/* workspace switcher */}</SidebarHeader>
		<SidebarContent>
			<SidebarGroup>
				<SidebarGroupLabel>Overview</SidebarGroupLabel>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton render={<Link href="/" />} isActive tooltip="Dashboard">
							<LayoutDashboard aria-hidden="true" />
							<span>Dashboard</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarGroup>
		</SidebarContent>
		<SidebarFooter>{/* account menu */}</SidebarFooter>
	</Sidebar>
	<SidebarInset>
		<SidebarTrigger />
		{/* the page */}
	</SidebarInset>
</SidebarProvider>
```

## Examples

### Icon rail

```showcase-example
c-sidebar-2
```

### Docs navigation

```showcase-example
c-sidebar-3
```

### Inspector panel

```showcase-example
c-sidebar-4
```

### Filter and loading

```showcase-example
c-sidebar-5
```

## API Reference

```showcase-api

```

## Keyboard

| Key              | Action                                      |
| :--------------- | :------------------------------------------ |
| `⌘ B` / `Ctrl B` | Toggles the sidebar (`keyboardShortcut`).   |
| `Tab`            | Moves through the menu's links and actions. |

## Accessibility

- Menu buttons are links or buttons with visible text (tooltips name them on the icon rail); the active page has `aria-current`.
- `SidebarTrigger` is a named button; on mobile the sidebar opens as a modal sheet.
