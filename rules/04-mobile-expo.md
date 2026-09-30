# 04 — Expo / React Native Standards

## Runtime boundary

Mobile code must remain React Native/Expo compatible. Do not import Node-only APIs, browser-only/DOM APIs, Next.js server modules, or DOM-specific packages into mobile or shared runtime packages.

```ts
// ❌ DON'T — this compiles fine on your laptop and then crashes at runtime
// on a physical device, because `fs` doesn't exist in the Hermes/RN runtime
import fs from 'fs';
export function loadConfig() {
  return JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
}

// ✅ DO — mobile-safe: no Node APIs, config comes from Expo's config system
import Constants from 'expo-constants';
export function loadConfig(): AppConfig {
  return AppConfigSchema.parse(Constants.expoConfig?.extra);
}
```

## Structure

```text
apps/mobile/src/
  app/                 # Expo Router routes — smart components, same role as app/**/page.tsx on web
    orders/
      index.tsx
  components/            # dumb, mobile-specific presentational components
  hooks/
  store/                  # Zustand, mobile-specific instances
```

Screen components are the smart/application layer here — they fetch, transform, and decide, same as a Next.js `page.tsx`. Reusable controls in `components/` stay data-agnostic — same smart/dumb rules as `03-web-nextjs.md`/`07-ui-system.md` apply, just without shadcn (it's web/Radix-only): CVA-equivalent variants, design tokens via NativeWind, `forwardRef`, standard `onChange`/`onBlur`/`onFocus` event contract mapped to RN's `onChangeText`/`onBlur`/`onFocus`.

```tsx
// ❌ DON'T — screen component with hardcoded, mobile-specific business logic
// baked directly into a "reusable" card component
function OrderCard({ orderId }: { orderId: string }) {
  const { data } = useQuery({ queryKey: ['order', orderId], queryFn: () => getOrder(orderId) });
  return <View>{/* renders data.customer.name directly, fetches its own data */}</View>;
}

// ✅ DO — screen fetches, card just renders
// app/orders/[id].tsx (smart)
export default function OrderScreen() {
  const { id } = useLocalSearchParams();
  const { data: order } = useQuery({ queryKey: orderKeys.detail(id), queryFn: () => getOrder(id) });
  return order ? <OrderCard order={order} /> : <LoadingState />;
}
// components/OrderCard.tsx (dumb)
function OrderCard({ order }: { order: Order }) { return <View>{/* pure rendering */}</View>; }
```

## Navigation

Navigation is explicit and type-safe (typed route params, validated with zod at the point they're read — not accessed as raw untyped strings pulled off `useLocalSearchParams()` and used directly).

```tsx
// ❌ DON'T
const { id } = useLocalSearchParams(); // typed as string | string[] | undefined — used blindly
getOrder(id as string); // straight back to a cast

// ✅ DO
const params = OrderRouteParamsSchema.parse(useLocalSearchParams());
getOrder(params.id); // fully typed and validated
```

## State

TanStack Query owns remote/server state, cache, and request lifecycle. Zustand owns local client/UI/workflow state. Do not duplicate the query cache into Zustand — same rule as web, same failure mode (two sources of truth silently drifting apart).

## Offline behavior

Do not claim the app is offline-capable unless offline semantics have actually been designed. Offline support requires explicit decisions for: cache policy, mutations, conflict resolution, retry, idempotency, authentication, and storage encryption.

```text
❌ DON'T say "the app works offline" just because TanStack Query happens
   to serve cached data when the network is down — that's accidental,
   partial offline behavior, not designed offline support. A mutation
   attempted offline in this state will silently fail or throw, and
   nobody has decided what should happen when connectivity returns.

✅ DO make an explicit, documented decision (e.g. an ADR — see
   14-documentation.md) for each of: what happens when a write is
   attempted offline, how conflicting writes are resolved when
   connectivity returns, and how long cached data is trusted before
   it's shown with a "may be stale" indicator.
```

## Secure storage

Tokens and sensitive local data use platform-appropriate secure storage (`expo-secure-store` or equivalent) — never `AsyncStorage` for secrets, and never secrets placed into source code or public Expo environment variables (`EXPO_PUBLIC_*` is bundled directly into the client binary and must be treated as public, the same as any string visible in the compiled app).

```ts
// ❌ DON'T
await AsyncStorage.setItem('authToken', token); // plaintext, unencrypted, readable by other apps in some configs

// ✅ DO
await SecureStore.setItemAsync('authToken', token); // platform keychain/keystore
```

## Responsive UI

React Native is inherently cross-device, but layouts still need testing across small phones, large phones, tablets (where supported), and accessibility font scaling (a user with large system text should not see truncated or overlapping UI).

## Accessibility

Support screen readers (`accessibilityLabel`, `accessibilityRole`), focus, adequate touch targets (44x44pt minimum per platform guidance), dynamic text sizing, and reduced motion where applicable.

## Deep linking

```tsx
// ❌ DON'T — a deep link handler that trusts and directly uses whatever
// path/params arrive, without validation — a deep link can be crafted
// by anyone and sent to a user via any channel (SMS, a malicious site)
useEffect(() => {
  Linking.addEventListener('url', ({ url }) => {
    const orderId = url.split('/orders/')[1];
    router.push(`/orders/${orderId}`); // unvalidated — could be anything
  });
}, []);

// ✅ DO — parse and validate deep link params through a schema before
// acting on them, exactly like any other untrusted external input
// (05-contracts-zod-api.md)
const DeepLinkSchema = z.object({ orderId: z.uuid() });
useEffect(() => {
  Linking.addEventListener('url', ({ url }) => {
    const parsed = parseDeepLink(url);
    const result = DeepLinkSchema.safeParse(parsed);
    if (result.success) router.push(`/orders/${result.data.orderId}`);
  });
}, []);
```

## Push notifications

```text
❌ DON'T — register for push notifications and request permission
   immediately on first app launch, before the user has any context for
   why the app wants them. This tanks opt-in rates and trains users to
   reflexively deny permission prompts from your app.

✅ DO — request push permission contextually, right before/after an
   action where the value is obvious (e.g. right after a user places an
   order that will have a "shipped" notification), and handle a denial
   gracefully — the app must remain fully functional without push
   permission granted.
```

Never assume a push token is stable forever — tokens can and do change (reinstall, OS-level reset); refresh and re-register the token according to the push provider's documented lifecycle, and treat a send failure due to an invalid token as an expected, handled case, not an exception to alert on.

## App state handling (foreground/background/inactive)

```tsx
// ❌ DON'T — ignore app state entirely; a screen that polls data every
// few seconds keeps polling even while the app is backgrounded,
// draining battery and wasting network/server resources for no
// user-visible benefit
useEffect(() => {
  const interval = setInterval(refetch, 5000);
  return () => clearInterval(interval);
}, []);

// ✅ DO — respect app state; pause polling/expensive work when backgrounded
useEffect(() => {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') refetch();
  });
  return () => subscription.remove();
}, []);
```

## Permissions

```text
❌ DON'T — request every permission the app might ever conceivably use
   (camera, location, contacts, notifications) in a burst at first launch.

✅ DO — request each permission at the specific moment its capability is
   actually needed (camera permission right when the user taps "take a
   photo," not before), with a clear explanation of why, and handle
   denial as a fully expected, designed-for path — not a crash or a dead end.
```

## Over-the-air updates (EAS Update / similar)

OTA updates let you ship JS-bundle changes without a full app-store review cycle — powerful, but with real limits worth knowing before relying on it: **native code changes (a new native module, an Expo SDK upgrade, new permissions) cannot ship via OTA** and require a full store submission. Don't design a release process that assumes OTA can always bail you out of a broken release — a broken native-level bug still requires the full store review timeline to fix, so treat native-touching changes with proportionally more release caution than a pure-JS change.

## Crash reporting and error tracking

Every production mobile build ships with crash reporting wired up (e.g. Sentry, or the equivalent this project has standardized on) before it goes to the store — a crash a developer never hears about is a crash that never gets fixed, and app-store crash-rate metrics affect store ranking and update approval.

## Platform-specific code

```tsx
// ❌ DON'T — sprinkle `Platform.OS === 'ios'` checks inline throughout a
// component's JSX, making the actual layout logic hard to follow
<View style={{ paddingTop: Platform.OS === 'ios' ? 44 : 24, marginTop: Platform.OS === 'ios' ? 0 : 8 }}>

// ✅ DO — isolate platform differences into a dedicated file/style object
// using Platform.select, so the component body reads as one coherent thing
const styles = StyleSheet.create({
  container: Platform.select({
    ios: { paddingTop: 44, marginTop: 0 },
    android: { paddingTop: 24, marginTop: 8 },
  }),
});
```

## `app.config.ts` and environment-specific builds

```ts
// ❌ DON'T — hardcode environment-specific values (API URL, bundle
// identifier) directly in app.json, making it impossible to build
// distinct dev/staging/production variants without hand-editing the
// file before every build
{ "expo": { "extra": { "apiUrl": "https://api.example.com" } } } // always production, even for local dev builds

// ✅ DO — app.config.ts (dynamic config), reading from environment
// variables so the same codebase produces distinct dev/staging/prod
// builds deterministically
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  extra: { apiUrl: process.env.API_URL },
  ios: { bundleIdentifier: process.env.APP_VARIANT === 'production' ? 'com.example.app' : 'com.example.app.dev' },
});
```

## EAS build profiles

Maintain distinct, explicit EAS build profiles (`development`, `preview`, `production`) in `eas.json` rather than one profile everyone reuses with manual overrides remembered ad hoc at build time — a manually-remembered override is exactly the kind of thing that gets forgotten right before a real release build.

## Testing on real devices, not just the simulator/emulator

```text
❌ DON'T — validate a feature only in the iOS Simulator/Android Emulator
   and assume it's done. Camera access, push notifications, biometric
   auth, background app refresh behavior, and real-world network
   conditions (a spotty connection, not the simulator's perfect one) all
   behave differently — sometimes completely differently — on physical
   hardware.

✅ DO — for any feature touching a device capability (camera, biometrics,
   push, background tasks, the multipart upload chunk-retry behavior
   from 20-object-storage.md), verify on at least one real physical
   device before calling it done.
```

## Nested layouts in Expo Router

```tsx
// ✅ DO — compose layouts the same deliberate way as Next.js's nested
// layouts (03-web-nextjs.md) — a tab layout wrapping stack layouts per
// tab, each only re-rendering what's actually within its own scope
// app/(tabs)/_layout.tsx
export default function TabsLayout() {
  return <Tabs><Tabs.Screen name="orders" /><Tabs.Screen name="profile" /></Tabs>;
}
// app/(tabs)/orders/_layout.tsx
export default function OrdersStackLayout() {
  return <Stack><Stack.Screen name="index" /><Stack.Screen name="[id]" /></Stack>;
}
```

## Biometric authentication

```tsx
// ❌ DON'T — treat a successful biometric prompt (Face ID/Touch ID) as
// itself the authorization for a sensitive action, with no server-side
// backing — biometric APIs authenticate against the DEVICE's local
// secure enclave, not against your backend; a compromised or jailbroken
// device's biometric prompt tells you nothing trustworthy about server-side identity
if (await LocalAuthentication.authenticateAsync()) {
  await chargeCard(); // the server has no idea this "authentication" happened at all
}

// ✅ DO — biometric auth unlocks a LOCALLY-held credential (e.g. a
// refresh token stored in secure storage, per this document's secure-
// storage section above), which is THEN used to make a real,
// server-verified authenticated request — the biometric prompt gates
// access to the credential; the credential is what the server actually trusts
const authResult = await LocalAuthentication.authenticateAsync();
if (authResult.success) {
  const token = await SecureStore.getItemAsync('refreshToken');
  await api.charge({ token }); // server independently verifies this token
}
```

## Handling app updates and forced upgrades

```text
❌ DON'T assume every user is running the latest app version — mobile
   updates roll out gradually and some users delay updating indefinitely.
   An API change that assumes every client is current will break for a
   real, sometimes large, population of users on an older build.

✅ DO — version your mobile API contracts deliberately (matching
   02-backend-nestjs.md's API-versioning guidance), and for a genuinely
   breaking change the old client cannot tolerate at all, implement a
   minimum-supported-version check that prompts a forced update rather
   than letting an incompatible old client silently fail in confusing ways.
```

## Testing across iOS and Android — don't assume parity

```text
❌ DON'T verify a feature only on one platform and assume the other
   behaves identically — safe-area insets, keyboard-avoiding behavior,
   permission-prompt wording/timing, and back-button/gesture navigation
   all differ meaningfully between iOS and Android.

✅ DO explicitly verify any UI/interaction change on BOTH platforms
   before calling it done, treating "works on iOS" and "works on
   Android" as two separate, both-required checklist items, not one
   assumption that covers both.
```

## React Native performance rules

```tsx
// ❌ DON'T — ScrollView + map for a long list (renders every row up front)
<ScrollView>{items.map((i) => <Row key={i.id} item={i} />)}</ScrollView>
// ✅ DO — a virtualized list
<FlashList data={items} renderItem={renderRow} estimatedItemSize={ROW_HEIGHT} keyExtractor={keyOf} />
```

```tsx
// ❌ DON'T — inline renderItem/keyExtractor recreated every render
<FlatList data={items} renderItem={({ item }) => <Row item={item} onPress={() => open(item.id)} />} />
// ✅ DO — stable references, memoized row
const renderRow = useCallback(({ item }: ListRenderItemInfo<Item>) => <MemoRow item={item} onOpen={open} />, [open]);
```

- Keep work off the JS thread: heavy computation in a worker/native module, animations on the UI thread (Reanimated), not `setState` per frame.
- Images: sized appropriately, cached (`expo-image`), never full-resolution originals for thumbnails.
- Avoid re-render storms from context: split contexts, select narrow Zustand slices (`06`).
- Measure on a mid-range **Android** device, not just a flagship iPhone; that's where regressions show first.
- Startup: lazy-load heavy screens/modules; keep the root layout light.

## Mobile release checklist

- [ ] Crash reporting configured for this build profile
- [ ] API base URL / env correct for the profile (`app.config.ts`)
- [ ] No debug flags, dev menus, or verbose logging in production profile
- [ ] Permissions requested are the minimum needed, each with a store-review-ready justification string
- [ ] Verified on physical iOS and Android devices, small and large screens, large font settings
- [ ] Forced-update gate tested against an old build
- [ ] OTA vs full-store submission decision made deliberately (native changes need a store build)
