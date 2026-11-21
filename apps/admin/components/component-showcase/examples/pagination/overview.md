## When to use

- Numbered page links between previous and next controls under a list, a table or search results
- Compact pagers of back and forward controls alone, or beside a page count, for narrow spaces
- Table footers pairing page controls with a rows-per-page select, a range count or a page-jump field

## When not to use

- A data table with sorting and filtering: [Data Table](/components/data-table) has its pager built in
- A long feed that loads more as people scroll: use a "Load more" [Button](/components/button) or infinite scrolling

## Notes

- `PaginationLink` renders a real anchor: give each page an `href` derived from your page state or URL
- Mark the current page with `isActive`; it gets `aria-current="page"`

## Pagination: pages of results

`Pagination` lays out page links with previous and next controls and an ellipsis for skipped ranges. Every page is a real link, so pages are crawlable, shareable and work with the browser's back button.

### What is Pagination?

`Pagination` (a `nav`) holds `PaginationContent`, whose `PaginationItem`s hold `PaginationLink`s, `PaginationPrevious`, `PaginationNext` and `PaginationEllipsis`.

### Why use Pagination?

Paged lists keep pages fast and positions stable. Links in the URL let people bookmark and share "page 4".

### Pagination features

- **Real links.** Each page has an `href`.
- **Current page.** `isActive` styles it and sets `aria-current`.
- **Compact forms.** Previous and next only, or with a page count.
- **Extras.** Rows-per-page selects, go-to fields and range counts, as the examples show.

## Integrating with other components

Put it under a [Table](/components/table) or a list, with a [Select](/components/select) for rows per page and an [Input](/components/input) to jump to a page. Read the page from the URL with your router.

## Frequently asked questions

### How do I keep the page in the URL?

Read `?page=` with your router and build each `PaginationLink`'s `href` from it.

### How many page numbers should I show?

The first, the last, and one or two around the current page, with ellipses between.

### Is it accessible?

It is a `nav` named for pagination; the current page carries `aria-current="page"`, and Previous and Next have text labels.
