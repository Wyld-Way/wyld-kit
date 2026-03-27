# @wyld/kit

Shared hooks, components, and services for the Wyld Way ecosystem.

## How it works

This repo is the **canonical source** for shared code. Each consuming app copies the source files into its own `src/lib/wyld-kit/` directory. No npm publish, no symlinks, no registry.

```
packages/wyld-kit/src/     <-- canonical source (this repo)
  |
  |-- copy to -->  Schools/web/src/lib/wyld-kit/
  |-- copy to -->  rewyld/src/lib/wyld-kit/        (future)
  |-- copy to -->  wyldwalk/src/lib/wyld-kit/       (future)
```

### To add wyld-kit to a new repo

```bash
# From the consuming repo's root
mkdir -p src/lib/wyld-kit
cp -r ../../packages/wyld-kit/src/* src/lib/wyld-kit/
```

Then import with `@/lib/wyld-kit`:
```tsx
import { useRequireAuth } from '@/lib/wyld-kit'
import AddressAutocomplete from '@/lib/wyld-kit/components/AddressAutocomplete'
```

### To sync after changes

If you edit wyld-kit in one repo and want to update the canonical source:

```bash
# 1. Copy your changes back to canonical
cp -r src/lib/wyld-kit/* ../../packages/wyld-kit/src/

# 2. Commit in wyld-kit repo
cd ../../packages/wyld-kit && git add -A && git commit -m "update from [repo-name]" && git push

# 3. Copy to other repos that use it
cd ../../Schools\ \(Nature\ People\)/web
cp -r ../../packages/wyld-kit/src/* src/lib/wyld-kit/
```

### Why not npm?

We tried file: references (Vercel can't resolve them), github: references (Vercel can't auth to private repos), and evaluated npm publish. For a 3-person team with fast-changing shared code, the copy approach is simplest. When the shared code stabilizes and we have 3+ consumers, we'll publish to npm.

---

## What's inside

| Export | Type | What it does |
|--------|------|-------------|
| `useRequireAuth` | Hook | Auth guard -- redirects if not authenticated |
| `createOrgService` | Factory | Org API service (create, join, list, update) |
| `createOrgHooks` | Factory | React Query hooks for orgs |
| `AddressAutocomplete` | Component | Mapbox address search with dropdown |

## Usage

### Auth guard

```tsx
import { useAuth } from '@/lib/auth'
import { useRequireAuth } from '@/lib/wyld-kit'

export default function ProtectedPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const { isReady } = useRequireAuth(isAuthenticated, isLoading, {
    loginPath: '/register',
    params: { redirect: '/setup' },
  })

  if (!isReady) return <Loading />
  return <div>Protected content</div>
}
```

### Org hooks

```tsx
// src/lib/orgHooks.ts (create once per app)
import client from '@/libs/HttpClients'
import { createOrgService, createOrgHooks } from '@/lib/wyld-kit'

const orgService = createOrgService(client)
export const { useMySchool, useCreateOrg, useJoinOrg } = createOrgHooks(orgService)
```

### Address autocomplete

```tsx
import AddressAutocomplete from '@/lib/wyld-kit/components/AddressAutocomplete'

<AddressAutocomplete
  value={address}
  onChange={setAddress}
  onSelect={(result) => {
    // result: { address, lat, lng, country }
  }}
  inputClassName="your-tailwind-classes"
  placeholder="Type your address"
/>
```

Requires `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` env var, or pass `mapboxToken` prop.

## Design principles

- **Factory pattern**: Services and hooks take your app's axios client. No singletons.
- **No build step**: Consumed as TypeScript source. Your app's bundler compiles it.
- **Styling**: Components accept className props. No hardcoded brand colors.
- **Copy, don't link**: Each repo owns its copy. Canonical source is this repo.

## Roadmap

### Now (v0.1 -- shipped)
- useRequireAuth, org hooks/service, AddressAutocomplete
- Consumed by: Schools

### Next (when needed)
- Migrate `rewyld/src/lib/auth/` here (AuthProvider, AuthGuard, useLogin, etc.)
- Migrate `rewyld/src/lib/marketplace/` here (GuideCard, EventCard, ClusteredMap, themes)
- Consume from: Rewyld, WyldWalk, Kripalu

### Later (when shared code stabilizes)
- Publish to npm as `@wyld/kit` (public, free)
- `npm install @wyld/kit` in every repo, no more copying
- Trigger: 3+ consumers, shared code changes less than monthly
