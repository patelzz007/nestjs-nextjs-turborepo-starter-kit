## When to use

- The persistent navigation column of an app, which can narrow to an icon rail or slide off screen
- Documentation trees with collapsible sections and sub-pages, or project lists narrowed by a search field
- A right-side inspector that shows the details of the record open beside it

## When not to use

- Site navigation across a header bar: use [Navigation Menu](/components/navigation-menu)
- A panel opened for one task, such as editing a record: use [Sheet](/components/sheet)

## Notes

- Menu links are anchors passed through `render`: `<SidebarMenuButton render={<Link href="/merchants" />}>`
- `SidebarProvider` listens for ⌘B / Ctrl B on the whole window to toggle the sidebar; set `keyboardShortcut` to change it
- The open state persists in a cookie by default (or any `storage` adapter), so the server renders the sidebar as people left it

## Sidebar: an app's navigation column

`Sidebar` is the composable side navigation of an app: a header, scrolling groups of menu items with icons, badges, actions and sub-menus, and a footer. `SidebarProvider` holds its state — open, collapsed to an icon rail, or off-canvas on mobile — and `SidebarTrigger` toggles it.

### What is Sidebar?

The column on the left of most admin tools. `SidebarMenu`s hold `SidebarMenuButton`s (links), with `SidebarMenuBadge`s, `SidebarMenuAction`s and nested `SidebarMenuSub`s. `SidebarInset` is the main content beside it.

### Why use Sidebar?

Apps with many sections need navigation that is always there but out of the way. Collapsing to an icon rail frees space without losing the map, and the mobile sheet keeps it reachable on phones.

### Sidebar features

- **Three collapse modes.** `offcanvas`, `icon` (a rail with tooltips) and `none`.
- **Variants.** `sidebar`, `floating` and `inset`.
- **Left or right.** `side`, for navigation or an inspector.
- **Menus.** Buttons, badges, actions, sub-menus and skeletons while loading.
- **Keyboard shortcut and persistence.** ⌘B to toggle; the state is stored in a cookie.

## Integrating with other components

Wrap groups in [Collapsible](/components/collapsible) for sections, use [Tooltip](/components/tooltip)s on the icon rail, [Badge](/components/badge)s for counts, and a [Dropdown Menu](/components/dropdown-menu) in the footer for the account. This app's own sidebar is built from it, driven by one navigation config.

## Frequently asked questions

### How do I collapse it to icons?

`collapsible="icon"` on `Sidebar`; labels hide and each button shows its tooltip.

### How does it work on mobile?

Below the mobile breakpoint it opens as a sheet over the page, toggled by `SidebarTrigger`.

### Can I put it on the right?

Yes: `side="right"`, as the Inspector Panel example does.

### Is it accessible?

The menu is a list of links with `aria-current` on the active one; the trigger is a named button, and the shortcut toggles it from anywhere.
