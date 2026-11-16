## When to use

- Location trails on docs, store and admin pages that link back up to each parent level
- Workspace, team and file paths whose levels carry avatars, icons, count badges or button styling
- Deep hierarchies whose middle levels collapse into an ellipsis or a dropdown menu

## When not to use

- A divider line between page sections: use [Separator](/components/separator)
- Steps of a process people move through in order: use [Stepper](/components/stepper)

## Notes

- `BreadcrumbLink` takes a router link through `render`: `<BreadcrumbLink render={<Link href="/merchants" />}>`
- Build the items from your route tree; the current page is a `BreadcrumbPage`, not a link

## Breadcrumb: where am I, and the way back

`Breadcrumb` shows the path from the top of the app to the current page, each level a link back up. It renders a `nav` with an ordered list, so assistive technology hears the trail and its length.

### What is Breadcrumb?

`BreadcrumbList` of `BreadcrumbItem`s, each a `BreadcrumbLink` (or the `BreadcrumbPage` for the current page), divided by `BreadcrumbSeparator`s. `BreadcrumbEllipsis` collapses the middle of a long trail, often into a [Dropdown Menu](/components/dropdown-menu).

### Why use Breadcrumb?

In deep apps — a merchant, its stores, a store's settings — people need to know where they are and jump back a level without the browser's back button.

### Breadcrumb features

- **Router links.** `render` takes your framework's link.
- **Custom separators.** Any icon or character.
- **Collapsing.** An ellipsis or a dropdown for the middle levels.
- **Rich levels.** Icons, avatars and badges.

## Integrating with other components

Put it in the page header above the title, collapse levels into a [Dropdown Menu](/components/dropdown-menu), and show workspaces with [Avatar](/components/avatar)s. The app's header breadcrumb is built from the same navigation config as the sidebar.

## Frequently asked questions

### Should the last item be a link?

No: the current page is a `BreadcrumbPage` (`aria-current="page"`), not a link to itself.

### How do I collapse a long trail?

Keep the first and the last two levels, and replace the rest with a `BreadcrumbEllipsis` inside a dropdown listing them.

### Is it accessible?

It is a `nav` named "breadcrumb" with an ordered list; separators are hidden from assistive technology and the current page carries `aria-current`.
