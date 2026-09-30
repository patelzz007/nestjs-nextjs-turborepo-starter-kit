# 06 — TanStack Query, Form, Table & Zustand

## Ownership matrix

| Concern | Owner |
|---|---|
| Remote API data | TanStack Query |
| Form values | TanStack Form |
| Validation | Zod (`05-contracts-zod-api.md`) |
| URL state | Next.js URL/search params where appropriate |
| Client UI state | Zustand |
| Table engine | TanStack Table |
| Persistence | API/database |
| Auth/session source | Auth boundary + server/session mechanism (`10-security-auth-authorization.md`) |

Memorize this table. Almost every "where does this state live?" question in a code review has its answer here.

## TanStack Query

Query keys must include every input that changes the result — centralize them per feature so they're never hand-typed inconsistently.

```ts
// ❌ DON'T — query keys typed by hand at every call site, easy to get
// subtly wrong (missing the filter, so two different filtered views
// share a cache entry and show each other's data)
useQuery({ queryKey: ['orders'], queryFn: () => getOrders(filters) }); // filters missing from the key!

// ✅ DO — centralized key factory, impossible to forget an input
export const orderKeys = {
  all: (): readonly ['orders'] => ['orders'],
  list: (filters: OrderFilters): readonly ['orders', 'list', OrderFilters] => ['orders', 'list', filters],
  detail: (id: OrderId): readonly ['orders', 'detail', OrderId] => ['orders', 'detail', id],
};
useQuery({ queryKey: orderKeys.list(filters), queryFn: () => getOrders(filters) });
```

Do not create one global "everything" query — a single giant query fetching "all app data" defeats caching, invalidation, and loading-state granularity entirely.

```ts
// ❌ DON'T
useQuery({ queryKey: ['app-data'], queryFn: getEverything }); // orders, users, settings, all in one blob

// ✅ DO — separate, independently-cacheable, independently-invalidatable queries
useQuery({ queryKey: orderKeys.list(filters), queryFn: () => getOrders(filters) });
useQuery({ queryKey: userKeys.detail(userId), queryFn: () => getUser(userId) });
```

Mutations invalidate or update affected queries intentionally (`queryClient.invalidateQueries({ queryKey: orderKeys.list(filters) })`), not with a blunt `queryClient.clear()` unless truly global data changed. Handle pending/success/error/cancellation, stale data, and refetch deliberately rather than only the happy path.

## Zustand

Use it for state that is genuinely client-owned:

```ts
// ✅ genuinely client-owned — nothing here came from the server
sidebarStore
filterDraftStore
wizardStore

// ❌ DON'T — this is server state wearing a Zustand costume; it will
// silently drift out of sync with TanStack Query's cache the first time
// a mutation invalidates the query but this store isn't updated too
usersStore   // mirroring useQuery(['users'])
```

### Zustand + SSR

Never use a single mutable global store instance shared across server requests.

```ts
// ❌ DON'T — module-level singleton store. On the server, this ONE
// instance is shared across every concurrent request being handled by
// the same process — user A's cart contents can leak into user B's
// response if their requests overlap.
export const useCartStore = create<CartState>((set) => ({ items: [], ... }));

// ✅ DO — a store FACTORY, instantiated fresh per request/render and
// provided via context, so no state ever leaks between users
export function createCartStore() {
  return create<CartState>((set) => ({ items: [], ... }));
}
// wired up via a React context provider created once per request
```

## TanStack Form

Forms derive validation from zod, expose controlled values, keep field state separate from business side effects, handle server-returned validation errors, support reset/default values, and preserve accessibility.

```tsx
const form = useForm({
  defaultValues: { customerId: '', items: [] } satisfies Partial<CreateOrderDto>,
  validators: { onChange: CreateOrderSchema },
  onSubmit: async ({ value }): Promise<void> => {
    await createOrder(CreateOrderSchema.parse(value));
  },
});
```

Validation logic never lives inside a generic input component — see `07-ui-system.md`'s low-level component rules.

```tsx
// ❌ DON'T — validation baked into the input component itself
function EmailField({ value, onChange }: Props) {
  const [error, setError] = useState<string | null>(null);
  const handleChange = (e) => {
    onChange(e.target.value);
    if (!e.target.value.includes('@')) setError('Invalid email'); // logic belongs in the schema, not here
  };
  return <input value={value} onChange={handleChange} />;
}

// ✅ DO — the input just renders what it's told; the FORM (driven by the
// zod schema) is the one place validation logic lives
<form.Field name="email">
  {(field) => (
    <TextField
      value={field.state.value}
      onChange={(e) => field.handleChange(e.target.value)}
      error={field.state.meta.errors[0]}
    />
  )}
</form.Field>
```

## TanStack Table

Column definitions are feature-owned (they know what a "customer" or "order" is); the reusable table component owns mechanics only — rendering, selection, pagination UI, sorting UI, column visibility, accessibility.

```tsx
interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: readonly TData[];
  onRowClick?: (row: TData) => void;
}
export function DataTable<TData, TValue>({ columns, data, onRowClick }: DataTableProps<TData, TValue>): JSX.Element { ... }
```

For server-side tables: `URL → page/search/sort/filter → server request → API → database`. Never load large result sets into the browser to simulate server-side pagination client-side.

## Memoization

Do not blindly wrap everything in `memo`/`useMemo`/`useCallback`.

```tsx
// ❌ DON'T — memoizing a trivial, cheap computation that re-runs in
// microseconds gains nothing and adds a dependency array to maintain
const total = useMemo(() => a + b, [a, b]);

// ✅ DO — memoize a genuinely expensive computation, or a value/callback
// passed to a memoized child that depends on referential stability to
// avoid re-rendering
const sortedRows = useMemo(() => expensiveSort(rows, sortConfig), [rows, sortConfig]);
const handleRowClick = useCallback((row: OrderRow) => { setSelected(row.id); }, []);
<MemoizedTable rows={sortedRows} onRowClick={handleRowClick} />
```

Design stable props first; optimize measured or obvious hot paths second, not speculatively everywhere.

## Optimistic updates — done carefully, with a real rollback

```tsx
// ❌ DON'T — an optimistic update with no rollback path; if the mutation
// fails, the UI is left showing a lie (a state that was never actually
// persisted) with no correction
const mutation = useMutation({
  mutationFn: updateOrderStatus,
  onMutate: async (newStatus) => {
    queryClient.setQueryData(orderKeys.detail(id), (old) => ({ ...old, status: newStatus }));
    // no snapshot taken, no onError to revert
  },
});

// ✅ DO — snapshot the previous state, apply the optimistic update,
// and revert to the snapshot on failure
const mutation = useMutation({
  mutationFn: updateOrderStatus,
  onMutate: async (newStatus) => {
    await queryClient.cancelQueries({ queryKey: orderKeys.detail(id) });
    const previous = queryClient.getQueryData(orderKeys.detail(id));
    queryClient.setQueryData(orderKeys.detail(id), (old) => ({ ...old, status: newStatus }));
    return { previous }; // passed to onError as `context`
  },
  onError: (err, newStatus, context) => {
    queryClient.setQueryData(orderKeys.detail(id), context.previous); // rollback
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: orderKeys.detail(id) }); // reconcile with server truth either way
  },
});
```

Not every mutation deserves optimistic updates — reserve them for actions where the outcome is near-certain to succeed and the UX benefit of instant feedback is real (toggling a checkbox, liking a post). For anything where failure is a meaningful, expected possibility (submitting a payment, an action with real server-side validation that could genuinely reject it), a normal pending state with a spinner is more honest than an optimistic update that has to be walked back.

## Infinite queries and pagination

```tsx
// ❌ DON'T — hand-roll "load more" state management with useState and
// manual array concatenation, reimplementing what TanStack Query already
// does correctly (deduplication, caching per page, race-condition-safe
// concurrent fetches)
const [pages, setPages] = useState<Order[][]>([]);
const loadMore = async () => {
  const next = await getOrders({ cursor: lastCursor });
  setPages((prev) => [...prev, next]); // no protection against a duplicate/out-of-order fetch
};

// ✅ DO — useInfiniteQuery
const query = useInfiniteQuery({
  queryKey: orderKeys.list(filters),
  queryFn: ({ pageParam }) => getOrders({ ...filters, cursor: pageParam }),
  initialPageParam: null as string | null,
  getNextPageParam: (lastPage) => lastPage.nextCursor,
});
```

## Prefetching

```tsx
// ✅ DO — prefetch data for a likely next navigation (e.g. on hover over
// a row that links to a detail page), so the detail page's data is
// already cached by the time the user actually clicks
<Link
  href={`/orders/${order.id}`}
  onMouseEnter={() => queryClient.prefetchQuery({ queryKey: orderKeys.detail(order.id), queryFn: () => getOrder(order.id) })}
>
```

Don't prefetch indiscriminately for every row in a long list on initial render — that turns into an unbounded burst of requests. Prefetch on a deliberate signal of likely intent (hover, viewport visibility for a short list), not unconditionally.

## TanStack Form — field arrays

```tsx
// ❌ DON'T — manage a dynamic list of form fields (e.g. order line items)
// with raw useState array manipulation, disconnected from the form
// library's own validation lifecycle
const [items, setItems] = useState([{ sku: '', quantity: 1 }]);

// ✅ DO — TanStack Form's field array API, so validation, error state,
// and submission all flow through the same system as every other field
<form.Field name="items" mode="array">
  {(field) => (
    <>
      {field.state.value.map((_, i) => (
        <form.Field key={i} name={`items[${i}].sku`}>
          {(itemField) => <TextField value={itemField.state.value} onChange={(e) => itemField.handleChange(e.target.value)} />}
        </form.Field>
      ))}
      <button type="button" onClick={() => field.pushValue({ sku: '', quantity: 1 })}>Add item</button>
    </>
  )}
</form.Field>
```

## Table virtualization

For a table rendering a large number of rows (hundreds or more) at once, render only the rows actually visible in the viewport (via a virtualization library such as `@tanstack/react-virtual`), rather than mounting every row's DOM nodes up front.

```tsx
// ❌ DON'T — render 5,000 <tr> elements at once because the API happened
// to return that many rows; the browser will visibly struggle to paint
// and scroll this smoothly, regardless of how well-optimized each ROW is
{rows.map((row) => <OrderRow key={row.id} order={row} />)}

// ✅ DO — virtualize: only the rows currently in (or near) the viewport
// are actually mounted, and the rest are represented by empty spacer height
const virtualizer = useVirtualizer({ count: rows.length, getScrollElement: () => scrollRef.current, estimateSize: () => 48 });
```

If the real fix is "the API shouldn't be returning 5,000 rows to the client in the first place" (per `03-web-nextjs.md`'s server-side pagination guidance), fix that first — virtualization is for genuinely large, deliberately-loaded datasets (e.g. a spreadsheet-like view), not a band-aid for a missing pagination boundary.

## Column visibility and table state persistence

```tsx
// ✅ DO — if a table's column visibility/sort/filter state should
// persist across a user's sessions (a common, expected UX for
// data-heavy admin tables), persist it explicitly and deliberately —
// e.g. in the URL for shareability (06 above), or in a per-user
// preference record via a genuine API call — never silently in
// component state that vanishes on refresh with no indication to the
// user that their view "reset" for no apparent reason.
```

## Query client default configuration

```tsx
// ❌ DON'T — leave every query at TanStack Query's raw defaults with no
// project-level thought about staleTime/gcTime, resulting in
// inconsistent, ad hoc refetch behavior decided differently by whoever
// wrote each individual query
useQuery({ queryKey: orderKeys.detail(id), queryFn: () => getOrder(id) }); // staleTime: 0 by default — refetches aggressively on every focus/mount

// ✅ DO — sensible, deliberate project-wide defaults set once on the
// QueryClient, overridden per-query only where a specific query's
// freshness needs genuinely differ from the norm
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: 2, refetchOnWindowFocus: true },
  },
});
```

## Handling query errors with an error boundary

```tsx
// ✅ DO — for queries where "just show an inline error" isn't the right
// UX (a hard failure that should escalate to the route's own error
// boundary), use throwOnError together with useQueryErrorResetBoundary
// so a retry from the error boundary properly resets the query's error state
const { reset } = useQueryErrorResetBoundary();
<ErrorBoundary onReset={reset} fallbackRender={({ resetErrorBoundary }) => (
  <ErrorState onRetry={resetErrorBoundary} />
)}>
  <Suspense fallback={<Skeleton />}>
    <OrdersList /> {/* uses useSuspenseQuery internally */}
  </Suspense>
</ErrorBoundary>
```

## Zustand middleware — `persist` and `devtools`

```ts
// ❌ DON'T — reach for Zustand's `persist` middleware by default on
// every store "just in case a refresh should preserve it" — persisting
// state that shouldn't survive a refresh (e.g. a multi-step wizard's
// in-progress, unsubmitted state) can create confusing, stale UI on
// a later visit
export const useWizardStore = create(persist<WizardState>((set) => ({ ... }), { name: 'wizard' })); // do we actually want this surviving a full browser restart, days later?

// ✅ DO — persist deliberately, only for state that genuinely benefits
// from surviving a reload (a user's deliberately chosen UI preference, like
// sidebar-collapsed state), and use devtools middleware in development
// only, never shipped to production bundles
export const useSidebarStore = create(
  devtools(
    persist<SidebarState>((set) => ({ isCollapsed: false, toggle: () => set((s) => ({ isCollapsed: !s.isCollapsed })) }), { name: 'sidebar-preference' }),
    { enabled: process.env.NODE_ENV === 'development' },
  ),
);
```

## Async validation with debounce in TanStack Form

```tsx
// ❌ DON'T — an async validator (e.g. "is this email already taken?")
// firing a network request on every single keystroke
<form.Field name="email" validators={{ onChangeAsync: checkEmailAvailable }}>

// ✅ DO — debounce the async validation so it only fires once the user
// has paused typing, not on every keystroke
<form.Field
  name="email"
  asyncDebounceMs={500}
  validators={{ onChangeAsync: checkEmailAvailable }}
>
```

## Selectors and preventing unnecessary re-renders from Zustand

```tsx
// ❌ DON'T — select the entire store object, which means this component
// re-renders on ANY change to ANY field in the store, even fields it
// never reads
const store = useOrdersUiStore(); // re-renders on every single store change

// ✅ DO — select only the specific slice this component actually needs
const isFilterPanelOpen = useOrdersUiStore((s) => s.isFilterPanelOpen); // only re-renders when THIS field changes
```

For a component that genuinely needs several fields, select them together with a shallow-equality comparator rather than either selecting the whole store or writing several separate `useOrdersUiStore` calls:

```tsx
// ✅ DO
const { isFilterPanelOpen, selectedOrderId } = useOrdersUiStore(
  useShallow((s) => ({ isFilterPanelOpen: s.isFilterPanelOpen, selectedOrderId: s.selectedOrderId })),
);
```

## Derived state — compute it, don't store it

```ts
// ❌ DON'T — store a value in Zustand that's entirely derivable from
// other state already in the store (or from TanStack Query's cache),
// which means it can silently drift out of sync with the thing it was derived from
interface OrdersUiState {
  orders: Order[];
  selectedCount: number; // derived from orders — now has to be manually kept in sync on every change
}

// ✅ DO — compute it at read time; there is no separate value that can
// ever become stale, because there's no separate value at all
const selectedCount = useMemo(() => orders.filter((o) => o.selected).length, [orders]);
```

This is the same underlying principle as this document's "don't duplicate server state into Zustand" rule, applied one level further: don't duplicate ANY derivable value into its own piece of state, server-sourced or not — a value that can be computed from other state should be computed, not stored redundantly.

## TanStack Query's `select` option — transforming without duplicating

```tsx
// ❌ DON'T — fetch the full order list and then separately maintain a
// derived "pending orders only" piece of state via useEffect + useState
const { data: orders } = useQuery({ queryKey: orderKeys.list(filters), queryFn: () => getOrders(filters) });
const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
useEffect(() => { setPendingOrders(orders?.filter((o) => o.status === 'pending') ?? []); }, [orders]);

// ✅ DO — TanStack Query's own `select` option transforms the cached
// data at read time, with no extra state and no useEffect synchronization needed
const { data: pendingOrders } = useQuery({
  queryKey: orderKeys.list(filters),
  queryFn: () => getOrders(filters),
  select: (orders) => orders.filter((o) => o.status === 'pending'),
});
```

## Mutation patterns — reference

```tsx
export function useCancelOrder(): UseMutationResult<Order, AppApiError, CancelOrderInput> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CancelOrderInput): Promise<Order> => {
      const raw = await api.post(`/orders/${input.orderId}/cancel`, CancelOrderSchema.parse(input.body)); // client validation (UX)
      return OrderSchema.parse(raw);                                                                      // response validation
    },
    onSuccess: (order) => {
      queryClient.setQueryData(orderKeys.detail(order.id), order);                   // precise update
      void queryClient.invalidateQueries({ queryKey: orderKeys.lists() });           // lists are now stale
    },
  });
}
```

```text
❌ Fire-and-forget mutation with no error UI      ✅ surface pending / success / error, map stable error codes to messages
❌ Invalidate everything on every mutation        ✅ update the one detail entry, invalidate only affected lists
❌ Mutation result typed as `any`/unparsed        ✅ parse through the response schema
❌ Ignoring 409 CONCURRENT_MODIFICATION           ✅ show "changed by someone else — reload" and refetch
```

## Table state ownership — full picture

```text
URL params        → page, pageSize, sortBy, sortDirection, filters   (shareable, refresh-safe, drives the server query)
TanStack Table    → column visibility, row selection, expansion      (controlled by the smart component when it matters outside the table)
Zustand           → purely client UI (density toggle, panel open)    (if it should persist, deliberately persist it)
TanStack Query    → the rows themselves                              (never copied elsewhere)
```

```tsx
// Manual (server-side) tables: tell the table the truth about who does the work
const table = useReactTable({
  data, columns,
  manualPagination: true, manualSorting: true, manualFiltering: true,
  rowCount: total,
  state: { pagination, sorting },
  onPaginationChange, onSortingChange,
  getCoreRowModel: getCoreRowModel(),
});
```

```text
❌ Client-side sort/filter on a paginated server table → sorts only the current page and lies to the user.
✅ Sort/filter/paginate on the server; the table just reflects the URL.
```

## Form patterns — reference

```text
Server errors → field errors:  map { code, details: { field } } from the API onto form.setFieldMeta.
Dirty guard:                   warn before leaving a dirty long form.
Submit lifecycle:              disable while submitting; keep values on failure; reset only on success.
Arrays:                        mode="array" fields (never parallel useState arrays).
Async validators:              debounced; the SERVER remains the source of truth (a "username available" check is a hint, not a guarantee — handle the 409).
Dependent fields:              derive with form.Subscribe / listeners, not with effects that setState.
```

```tsx
// ❌ effect-driven derived form values (double render, drift)
useEffect(() => { form.setFieldValue('total', qty * price); }, [qty, price]);
// ✅ derive at render / in the validator; store only what the user actually entered
const total = qty * price;
```

## Query error handling matrix

| Error kind | Example | UI behavior |
|---|---|---|
| Network | offline / timeout | retry affordance, keep stale data visible |
| 401 | session expired | refresh once, else redirect to login preserving intent |
| 403 | no permission | explanatory state, no retry |
| 404 | resource gone | not-found state |
| 409 | conflict / concurrent modification | "changed elsewhere" + refetch |
| 422/400 | validation | field-level errors |
| 429 | rate limited | back off; show wait hint from `retryAfterSeconds` |
| 5xx | server | generic error + retry + requestId for support |
