# 03 — Next.js Web Standards

## Rendering

Default to server rendering where the feature doesn't need browser-only interactivity. Use client components deliberately — a `use client` boundary should exist because the component needs browser APIs, local interaction state, event handlers, client-side subscriptions, or a client-only library.

```tsx
// ❌ DON'T — the whole page is marked 'use client' because of one button,
// which means the ENTIRE page loses server-rendering benefits (SEO, initial
// load performance, no client-side data-fetching waterfall) for no reason
'use client';
export default function OrderPage({ order }: { order: Order }) {
  return (
    <div>
      <OrderSummary order={order} />
      <OrderHistory order={order} />
      <button onClick={() => window.print()}>Print</button>
    </div>
  );
}

// ✅ DO — the interactivity is isolated to the one leaf that needs it;
// everything else stays a server component
export default function OrderPage({ order }: { order: Order }) {
  return (
    <div>
      <OrderSummary order={order} />
      <OrderHistory order={order} />
      <PrintButton />          {/* only this tiny component is 'use client' */}
    </div>
  );
}
```

Push the `use client` boundary as far down the tree as it can go — to the smallest leaf that genuinely needs it, not up to the nearest page or layout because that was easier to reason about in the moment.

## Smart vs dumb components — mandatory, no exceptions

This is the single most load-bearing convention in the frontend codebase, and the one most likely to quietly erode over time if it isn't actively enforced in review.

### Smart component
Owns: data fetching, mutations, URL/search params, domain-specific transformations, feature state, permission decisions, loading/error/empty orchestration.

```text
app/orders/page.tsx
  ↓
OrdersPage        (smart — fetches, transforms, decides)
  ↓
OrdersTable        (dumb — renders what it's given)
```

```tsx
// ✅ DO — the page owns everything about WHERE the data comes from and HOW it's shaped
export default async function OrdersPage(): Promise<JSX.Element> {
  const orders = await getOrders();          // data fetching lives here
  const rows = orders.map(toOrderRow);         // transformation lives here
  return <OrdersTable rows={rows} />;
}
```

### Dumb component
Owns: presentation, accessibility, interaction primitives, controlled props, slots/composition. Must **not** know API endpoints, Prisma models, business-specific fetches, application permission logic, or how a page's data is stored.

```tsx
// ❌ DON'T — a "reusable" component that secretly isn't reusable at all,
// because it's hardwired to one specific API endpoint and one specific
// business concept (rewards). Using it anywhere else, or testing it in
// isolation, or reusing its layout for a DIFFERENT list of things, is
// now impossible without either duplicating it or ripping the fetch out.
function UserRewardTable() {
  const { data } = useQuery({ queryKey: ['rewards'], queryFn: getRewards });
  if (!data) return <Spinner />;
  return (
    <table>
      {data.map((reward) => <tr key={reward.id}><td>{reward.name}</td></tr>)}
    </table>
  );
}

// ✅ DO — generic, reusable, data-agnostic; the SAME DataTable component
// can render orders, rewards, users, or anything else, because it has
// zero opinions about where its data came from
<DataTable columns={columns} data={rows} />
```

A concrete way to catch this in review: **could this component be unit-tested by passing it plain props and asserting on the rendered output, with zero mocking of `fetch`/TanStack Query/an API client?** If the answer is no — if you'd need to mock a network call just to render the component in a test — it isn't a dumb component, no matter what folder it's in.

## Low-level component rule, illustrated further

```tsx
// ❌ DON'T — a "generic" status badge that's actually hardcoded to one
// specific domain's set of statuses. Adding a new order status means
// EDITING this component, even though nothing about badges themselves changed.
function StatusBadge({ status }: { status: string }) {
  if (status === 'pending') return <span className="bg-yellow-100">Pending</span>;
  if (status === 'shipped') return <span className="bg-blue-100">Shipped</span>;
  if (status === 'delivered') return <span className="bg-green-100">Delivered</span>;
  return <span>{status}</span>;
}

// ✅ DO — fully driven by props; a NEW status never requires touching this file
interface StatusBadgeProps<TStatus extends string> {
  status: TStatus;
  config: Record<TStatus, { label: string; className: string }>;
}
function StatusBadge<TStatus extends string>({ status, config }: StatusBadgeProps<TStatus>): JSX.Element {
  const { label, className } = config[status];
  return <span className={className}>{label}</span>;
}
// the smart component (or a feature-level column definition) supplies the
// order-specific config: { pending: { label: 'Pending', className: '...' }, ... }
```

## Server state vs client state

TanStack Query owns server state. Do not copy `query.data` into a Zustand store just to make it "globally available."

```tsx
// ❌ DON'T — this now has TWO sources of truth for "the current orders,"
// and they can silently disagree the moment a mutation invalidates the
// query but nobody remembers to also update the Zustand copy
const useOrdersStore = create<{ orders: Order[]; setOrders: (o: Order[]) => void }>((set) => ({
  orders: [],
  setOrders: (orders) => set({ orders }),
}));
function OrdersPage() {
  const { data } = useQuery({ queryKey: ['orders'], queryFn: getOrders });
  const setOrders = useOrdersStore((s) => s.setOrders);
  useEffect(() => { if (data) setOrders(data); }, [data]); // duplicated state, now two places to keep in sync
}

// ✅ DO — TanStack Query is the ONLY place "the current orders" lives
function OrdersPage() {
  const { data } = useQuery({ queryKey: orderKeys.list(filters), queryFn: () => getOrders(filters) });
}
```

Zustand owns genuinely client-owned state: UI preferences, transient workflow state, sidebar open/closed, local drafts, client-only coordination. Full ownership matrix: `06-tanstack-state-forms-tables.md`.

## URL state

Search/filter/sort/pagination that should be shareable/bookmarkable belongs in URL state where practical — a user should be able to copy the URL, send it to a coworker, and land on the exact same filtered view.

```tsx
// ❌ DON'T — filter state lives only in useState, so refreshing the page
// or sharing the link loses it entirely
const [status, setStatus] = useState<OrderStatus | null>(null);

// ✅ DO — filter state lives in the URL, is shareable, and survives a refresh
const searchParams = useSearchParams();
const status = OrderStatusSchema.nullable().parse(searchParams.get('status'));
```

For SSR-heavy tables, prefer server-driven querying: `URL → page/search/sort/filter → server request → API → database`. Never load 100,000 records into the browser to simulate server-side pagination client-side — that defeats the entire point of pagination.

## Forms

TanStack Form owns form state; zod owns validation. The UI primitive (e.g. `TextField`) contains no validation logic of its own. Full detail: `06-tanstack-state-forms-tables.md`, `07-ui-system.md`.

## Tables

TanStack Table is the table engine. Domain-specific column definitions live near the feature; the reusable `DataTable` component doesn't know what a "customer," "reward," or "invoice" is. Full detail: `06-tanstack-state-forms-tables.md`.

## Loading/error/empty states

```tsx
// ❌ DON'T — only the happy path is handled; a slow network, an empty
// result, and a 403 all render the exact same (broken-looking) blank table
function OrdersTable({ data }: { data: Order[] | undefined }) {
  return <table>{data?.map(row => <OrderRow key={row.id} order={row} />)}</table>;
}

// ✅ DO — every meaningfully different state gets a deliberate rendering
function OrdersTable({ state }: { state: AsyncState<Order[]> }) {
  switch (state.status) {
    case 'loading': return <TableSkeleton />;
    case 'error': return <ErrorState message={state.error} onRetry={state.retry} />;
    case 'success':
      return state.data.length === 0
        ? <EmptyState message="No orders yet" />
        : <table>{state.data.map(row => <OrderRow key={row.id} order={row} />)}</table>;
  }
}
```

Every async UI deliberately handles: initial loading, background refetch, empty result, validation error, authorization error, server error, network error, and retry.

## Responsive design

Test every UI change at mobile (~375px), tablet (~768px), desktop (~1280px), and wide desktop widths, using Tailwind's responsive utilities. Don't assume desktop CSS "will probably work" on mobile without actually checking.

## Accessibility

Semantic HTML first. Keyboard behavior must work — every interactive element reachable and operable via `Tab`/`Enter`/`Space`/arrow keys as appropriate. Focus must be visible. Interactive elements need accessible names. Dialogs must trap/manage focus correctly. Tables need correct header semantics (`<th scope="col">`, etc.). Never use color alone to indicate state (e.g. a red border with no icon/text is invisible to a colorblind user).

## Theming

All UI works in light and dark mode via design tokens — never hardcoded colors in reusable components. Full detail: `07-ui-system.md`.

## Layout preservation

```text
❌ DON'T — a task asking you to "fix the validation error message on the
   signup form" is not an invitation to also restyle the form's spacing,
   change its button colors, or reorganize its layout, even if you notice
   something you'd personally do differently.

✅ DO — fix exactly what was asked. If you genuinely believe a layout
   change is warranted, propose it explicitly and separately, and let a
   human decide, rather than bundling it into an unrelated change.
```

For a functional change, preserve the existing layout unless the task explicitly asks for a redesign.

## Error boundaries and `error.tsx`

Every route segment that can fail in a way specific to that segment should have its own `error.tsx`, rather than relying on one giant root-level error boundary that shows the same generic message for every possible failure anywhere in the app.

```tsx
// ❌ DON'T — no error.tsx anywhere except the root layout's; an error
// deep in the orders feature blanks out the ENTIRE app (including the
// navigation, sidebar, everything) instead of just the part that broke
// app/layout.tsx (only place with error handling)

// ✅ DO — scoped error boundaries; an error in the orders list doesn't
// take down navigation or unrelated parts of the page
// app/orders/error.tsx
'use client';
export default function OrdersError({ error, reset }: { error: Error; reset: () => void }): JSX.Element {
  return (
    <div>
      <p>Couldn't load orders.</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

## Suspense boundaries and streaming

```tsx
// ❌ DON'T — one slow data fetch on a page blocks the ENTIRE page from
// rendering anything at all, even the parts that had nothing to do with
// the slow fetch
export default async function DashboardPage() {
  const orders = await getOrders();           // fast
  const analytics = await getSlowAnalytics(); // slow — blocks everything above it too
  return <div><OrdersSummary orders={orders} /><AnalyticsPanel data={analytics} /></div>;
}

// ✅ DO — wrap the slow part in Suspense so the rest of the page streams
// in immediately, and the slow section shows its own loading state
export default async function DashboardPage() {
  const orders = await getOrders();
  return (
    <div>
      <OrdersSummary orders={orders} />
      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsPanel /> {/* fetches its own data internally, streams in when ready */}
      </Suspense>
    </div>
  );
}
```

## Metadata and SEO

```tsx
// ❌ DON'T — no metadata at all, or metadata hardcoded identically
// across every page regardless of actual content
export const metadata = { title: 'My App' }; // same title on every single page

// ✅ DO — per-route, content-aware metadata, generated dynamically where
// the content is dynamic
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const order = await getOrder(params.id);
  return { title: `Order #${order.id} — My App`, description: `Details for order ${order.id}` };
}
```

## Environment variables on the client

```tsx
// ❌ DON'T — assume any environment variable is safely readable in a
// client component just because it's referenced somewhere
'use client';
function Component() {
  const secret = process.env.DATABASE_URL; // undefined at runtime in the browser — AND if it somehow worked, would be a severe leak
}

// ✅ DO — only NEXT_PUBLIC_-prefixed variables are available client-side,
// by Next.js's own design; treat every one of them as public, full stop
// (10-security-auth-authorization.md)
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
```

## Image and font loading

```tsx
// ❌ DON'T — a raw <img> tag for content images, which skips Next.js's
// automatic optimization, responsive sizing, and lazy loading entirely
<img src="/product.jpg" />

// ✅ DO — next/image, which handles responsive sizing, format
// negotiation, and lazy loading by default
import Image from 'next/image';
<Image src="/product.jpg" alt="Product photo" width={400} height={300} />
```

```tsx
// ❌ DON'T — a font loaded via a hand-written <link> tag to Google
// Fonts, which introduces a render-blocking external request and layout
// shift as the font swaps in
<link href="https://fonts.googleapis.com/css?family=Inter" rel="stylesheet" />

// ✅ DO — next/font, which self-hosts and inlines font loading with no
// layout shift and no external request at runtime
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'] });
```

## Middleware

```tsx
// ❌ DON'T — put business logic (fetching data, complex authorization
// decisions) inside Next.js middleware, which runs on the Edge runtime
// with real constraints (no full Node APIs, tight execution time limits)
// and executes on EVERY matching request, so anything slow here is slow everywhere
export function middleware(request: NextRequest) {
  const user = await db.user.findUnique(...); // ❌ heavy DB work in middleware
}

// ✅ DO — middleware for cheap, fast, structural concerns only: redirects,
// header inspection, lightweight auth-cookie presence checks. Defer
// anything heavier to the actual route/page.
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has('session');
  if (!hasSession && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}
```

## Parallel and intercepting routes

Use parallel routes (`@slot` folders) when a layout genuinely needs to render more than one independent page-like section simultaneously (e.g. a dashboard with an activity feed and a stats panel that load/error independently). Use intercepting routes (`(..)folder`) specifically for modal-over-content patterns where the same content also needs a real, shareable, full-page URL (e.g. a photo that opens as a modal from a feed but is also a real page when visited directly). Don't reach for either pattern's complexity for a case a simple client-side modal component would solve just as well with far less structural overhead — these are for genuinely URL-addressable, independently-loading UI, not a decoration.

## Route handlers (`app/api/*/route.ts`)

```ts
// ❌ DON'T — business logic and direct database access inside a Next.js
// route handler, duplicating what the real NestJS API already does, and
// creating a second, inconsistent place authorization/validation rules
// can drift out of sync
export async function POST(request: Request) {
  const body = await request.json(); // unvalidated
  const order = await prisma.order.create({ data: body }); // direct DB access from the WEB app, bypassing the API's authorization/audit-log layer entirely
  return Response.json(order);
}

// ✅ DO — a Next.js route handler is for web-specific concerns (a
// webhook receiver Next.js itself needs to own, a BFF-style thin proxy
// with request-shaping specific to the web client) — it calls the real
// API, it doesn't reimplement the API
export async function POST(request: Request) {
  const body = CreateOrderSchema.parse(await request.json());
  const order = await apiClient.post('/orders', body); // delegates to the real, authorized, audited API
  return Response.json(order);
}
```

## `not-found.tsx` and `notFound()`

```tsx
// ❌ DON'T — render a generic "not found" message inline wherever a
// lookup might fail, inconsistently, per-component
if (!order) return <div>Not found</div>;

// ✅ DO — Next.js's notFound() + a route-level not-found.tsx, so a
// missing resource gets a proper 404 status code (important for SEO and
// for any client correctly interpreting the response) and a consistent UI
import { notFound } from 'next/navigation';
export default async function OrderPage({ params }: { params: { id: string } }) {
  const order = await getOrder(params.id);
  if (!order) notFound();
  return <OrderDetail order={order} />;
}
```

## Revalidation strategy (ISR)

```tsx
// ❌ DON'T — leave every page's caching behavior at whatever the
// framework's default happens to be, without a deliberate decision —
// a page can end up serving stale data indefinitely, or refetching on
// every single request when it didn't need to
export default async function ProductPage() { ... } // no revalidate declared at all

// ✅ DO — declare the actual freshness requirement explicitly, per route
export const revalidate = 3600; // this content is fine being up to an hour stale
// or, for content that must always be current:
export const dynamic = 'force-dynamic';
```

## Cookies and headers in Server Components/Actions

```tsx
// ❌ DON'T — read a raw cookie value and trust it directly for an
// authorization decision without validating it server-side
const role = cookies().get('role')?.value; // a cookie is CLIENT-CONTROLLED data — see 05-contracts-zod-api.md's "never trust the frontend"
if (role === 'admin') { ... }

// ✅ DO — a cookie may identify a SESSION, but the actual authorization
// decision is derived server-side from that session, from a source the
// client can't forge (a database lookup, a verified signed token)
const sessionToken = cookies().get('session')?.value;
const session = await verifySession(sessionToken); // verifies signature/validity server-side
if (session.user.role === 'admin') { ... }
```

## `redirect()` vs `notFound()` — using the right one

`redirect()` is for "this content has moved" or "you need to be somewhere else first" (an unauthenticated user hitting a protected route). `notFound()` is for "this specific resource does not exist." Conflating them (e.g. redirecting an unauthenticated user to a generic 404 instead of a login page, or 404-ing instead of redirecting a moved resource) actively confuses users and breaks bookmarks/expectations — pick the one that honestly describes what happened.

## A full worked example — smart/dumb split applied end to end

To make the abstraction concrete across every layer this document covers, here's one feature (an orders list with filtering) built correctly, start to finish.

```tsx
// app/orders/page.tsx — SMART: owns data fetching, URL state, transformation
export default async function OrdersPage({ searchParams }: { searchParams: Record<string, string> }): Promise<JSX.Element> {
  const filters = OrderFiltersSchema.parse(searchParams); // validated URL state
  const orders = await getOrders(filters);                // data fetching
  const rows = orders.map(toOrderRow);                      // transformation
  return (
    <div>
      <OrdersFilterBar filters={filters} />   {/* dumb — renders filter UI, reports changes via callback */}
      <OrdersTable rows={rows} />              {/* dumb — renders rows, knows nothing about orders as a concept beyond its typed props */}
    </div>
  );
}

// _components/orders-filter-bar.tsx — DUMB: no data fetching, no URL manipulation logic of its own
interface OrdersFilterBarProps {
  filters: OrderFilters;
  onChange?: (filters: OrderFilters) => void; // actual URL navigation happens in a thin client wrapper, not here
}
function OrdersFilterBar({ filters, onChange }: OrdersFilterBarProps): JSX.Element {
  return <StatusSelect value={filters.status} onChange={(status) => onChange?.({ ...filters, status })} />;
}

// _components/orders-filter-bar.client.tsx — the thin client boundary that
// actually knows about Next.js navigation, kept as small as possible per
// this document's "push use client down to the smallest leaf" rule
'use client';
function OrdersFilterBarClient(props: OrdersFilterBarProps): JSX.Element {
  const router = useRouter();
  return <OrdersFilterBar {...props} onChange={(filters) => router.push(`?${new URLSearchParams(filters)}`)} />;
}
```

Notice how cleanly this maps onto every rule this document set has already established: data ownership at the page (Rule 9 from the original core-principles framing), transformation at the smart layer, a dumb component with zero knowledge of URLs/routing, and the `use client` boundary isolated to the one small piece that genuinely needs it.

## Streaming server actions with progress feedback

```tsx
// ❌ DON'T — a long-running server action with no feedback at all
// beyond "pending," leaving the user staring at a spinner with no idea
// whether it's actually making progress or has silently hung
const [isPending, startTransition] = useTransition();
<button onClick={() => startTransition(() => generateReport())}>{isPending ? 'Loading...' : 'Generate'}</button>

// ✅ DO — for a genuinely long operation, prefer an async job pattern
// (09-messaging-and-jobs.md) with a pollable/subscribable status,
// rather than a single long-blocked server action the user has no
// visibility into
const { data: job } = useMutation({ mutationFn: startReportGeneration });
const { data: status } = useQuery({
  queryKey: ['report-job', job?.id],
  queryFn: () => getJobStatus(job.id),
  enabled: !!job,
  refetchInterval: (data) => (data?.status === 'complete' ? false : 2000),
});
```

## Keyboard interaction reference (accessibility)

Every custom interactive widget must match the platform's expected keyboard behavior. If you use the shadcn/Radix primitive, this is handled — verify it, don't assume it after customizing.

| Widget | Must support |
|---|---|
| Button | `Enter` and `Space` activate |
| Link | `Enter` activates |
| Dialog | Focus moves in on open, `Tab` cycles inside, `Esc` closes, focus returns to the trigger |
| Menu / dropdown | Arrow keys move, `Enter` selects, `Esc` closes, type-ahead where expected |
| Tabs | Arrow keys switch tabs, `Tab` moves into the panel |
| Combobox / select | Arrows navigate, `Enter` selects, `Esc` closes, announced selected value |
| Checkbox / switch | `Space` toggles |
| Table with row actions | Actions reachable by `Tab`; row click must also have a keyboard path |

```tsx
// ❌ DON'T — clickable div with no keyboard or semantic support
<div onClick={() => open(row)}>{row.name}</div>

// ✅ DO — a real interactive element
<button type="button" onClick={() => open(row)}>{row.name}</button>
```

## Focus visibility

```css
/* ❌ DON'T remove the focus ring with nothing in its place */
*:focus { outline: none; }
/* ✅ DO style it consistently through a token */
:focus-visible { outline: 2px solid hsl(var(--ring)); outline-offset: 2px; }
```

## Live regions and async feedback

```tsx
// ❌ DON'T — a toast/inline message that appears visually but is never announced
<div className="text-green-600">Saved</div>
// ✅ DO — announce status changes to assistive tech
<div role="status" aria-live="polite">Saved</div>          // non-urgent
<div role="alert">Payment failed. Please try again.</div>   // urgent
```

## Internationalization readiness

Even if the product ships in one language today, don't make retrofitting impossible.

```tsx
// ❌ DON'T — concatenated, English-only, locale-blind strings
<p>{count + ' orders on ' + date.toLocaleDateString()}</p>
// ✅ DO — message catalog with ICU plurals, and Intl for numbers/dates/currency
<p>{t('orders.summary', { count, date })}</p>
new Intl.NumberFormat(locale, { style: 'currency', currency: order.currency }).format(order.total);
```

Store dates as UTC epoch/ISO on the wire; format in the user's locale and time zone at the edge (the dumb component receives a formatter or preformatted string from the smart component — it never hardcodes `en-US`).

## Forms UX rules that prevent real bugs

```text
❌ Submit button that stays enabled while submitting        → double submit (two orders, two charges)
✅ Disable / show loading state during submit; the SERVER is still idempotent (09) because the
   client guard alone can be bypassed (05).
❌ Clearing the form on failure                             → user loses their input
✅ Preserve input; map server field errors back onto fields.
❌ Validation firing on first keystroke                     → shouting "invalid email" at "a"
✅ Validate on blur first, then on change once touched.
❌ Error message only in a toast                            → screen reader / timing misses it
✅ Inline, associated via aria-describedby, plus summary for long forms.
❌ Unload data loss                                          → half-filled form closed by accident
✅ Warn on navigation away when dirty, for long forms.
```

## Handling stale UI after a server-side change

If a mutation can fail because the underlying record changed (optimistic-lock conflict from `08`), surface a specific, actionable state — "This reward was updated by someone else. Reload to see the latest version." — rather than a generic error. The API returns a stable error code (`CONCURRENT_MODIFICATION`); the smart component maps it to that UX.
