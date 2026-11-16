## When to use

- Site headers whose top-level items open panels of links, such as docs, products or industry pages
- Mega-menu panels that lay out links with summaries in columns, with icons and a call-to-action button
- Header rows that mix panel triggers with plain top-level links styled to match

## When not to use

- Actions on the current page, such as edit, share or sign out, opened from one button: use [Dropdown Menu](/components/dropdown-menu)
- The sections of a signed-in app, listed down the edge of the screen: use [Sidebar](/components/sidebar)

## Notes

- `NavigationMenuLink` takes its anchor through `render`: point it at a real route with your router's link
- `align` on the content lines a panel up with its trigger

## Navigation Menu: site navigation with panels

`NavigationMenu` is a horizontal bar of links and triggers that open panels of more links, built on Base UI's navigation menu. Panels open on hover or click, an indicator follows the active trigger, and the arrow keys move along the bar.

### What is Navigation Menu?

The header of a marketing site or a docs portal: "Products ▾", "Docs ▾", "Pricing". `NavigationMenuList` holds `NavigationMenuItem`s; each has a `NavigationMenuTrigger` and a `NavigationMenuContent`, or a plain `NavigationMenuLink`.

### Why use Navigation Menu?

Large sites have more destinations than fit in a bar. Panels group them with summaries, so people find the right page without a separate index.

### Navigation Menu features

- **Panels.** Any layout of links, grids and calls to action.
- **Plain links.** A `NavigationMenuLink` straight in an item, beside the panel triggers.
- **Indicator.** Follows the hovered or focused trigger.
- **Keyboard.** The arrow keys move along the bar and into panels.

## Integrating with other components

Use [Item](/components/item)s or plain links with icons inside panels, and a [Button](/components/button) for a panel's call to action. For signed-in app navigation, use a [Sidebar](/components/sidebar) instead.

## Frequently asked questions

### Navigation Menu or Dropdown Menu?

A navigation menu navigates between pages (links); a [Dropdown Menu](/components/dropdown-menu) runs actions on the current page.

### Does it work on mobile?

Hover panels do not suit touch screens: on narrow screens, show the same links in a [Sheet](/components/sheet) or a [Drawer](/components/drawer).

### Is it accessible?

Yes: it is a `nav` whose triggers expose `aria-expanded`; the arrow keys, Enter and Escape work, and links are real anchors.
