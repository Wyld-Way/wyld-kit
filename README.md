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
| `createAuthService` | Factory | Login (email/pw, Google, Apple), forgot/reset password, fetchMe, fetchMeFull (user + memberships), logout |
| `createS3UploadService` | Factory | S3 direct browser upload with graceful degradation when AWS env unset |
| `AddressAutocomplete` | Component | Mapbox address search with dropdown |

### Selective copy is encouraged

Not every consumer needs every export. Kripa skips `createOrgService`/`createOrgHooks` (uses raw fetch, no React Query) and `AddressAutocomplete` (no Mapbox SDK in their deps). Only copy `services/<name>.ts` files you'll actually use, and trim the local `index.ts` to match — otherwise an unused import drags peer deps into your bundle.

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

### Auth service

```tsx
// src/lib/api/user-auth.ts (create once per app)
import http, { setStoredToken } from './http-client'
import { createAuthService } from '@/lib/wyld-kit'

const auth = createAuthService(http, {
  storage: { setToken: setStoredToken },
})

export const { login, googleLogin, appleLogin, forgotPassword, resetPassword, fetchMe, fetchMeFull, logout } = auth
```

Apps wrap to add localStorage user persistence or app-specific behavior (Kripa does this). The kit doesn't assume how each app persists session state — pass a storage adapter or skip it.

### S3 upload

```tsx
import { createS3UploadService, FOLDERS } from '@/lib/wyld-kit'

const uploader = createS3UploadService({
  region: process.env.NEXT_PUBLIC_AWS_S3_REGION_NAME,
  accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
  bucket: process.env.NEXT_PUBLIC_AWS_STORAGE_BUCKET_NAME,
})

// In a component:
if (uploader.isConfigured) {
  const filename = await uploader.upload(file, FOLDERS.GUIDE_COVER)
  // filename is what you save to the backend, not the full URL
}
```

`isConfigured` is `false` when any AWS env value is missing — UI should hide the upload affordance, NOT throw. `aws-sdk` lazy-imports inside `upload()` so the bundle only ships when actually used.

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

### Now (v0.2 -- shipped 2026-04-28)
- useRequireAuth, org hooks/service, AddressAutocomplete (v0.1)
- createAuthService (login + OAuth + password reset + fetchMeFull) (v0.2)
- createS3UploadService (graceful-degrading direct uploads) (v0.2)
- Consumed by: Schools, Kripa (selective subset)
- **Drift watch:** when you sync canonical → app, list which files actually changed in the commit message so other repos know what to pull. There is no CI check for sync drift today.

### Next (when needed)
- Migrate `rewyld/src/lib/auth/` here (AuthProvider, AuthGuard, useLogin, etc.)
- Migrate `rewyld/src/lib/marketplace/` here (GuideCard, EventCard, ClusteredMap, themes)
- Consume from: Rewyld, WyldWalk, Kripalu

### Later (when shared code stabilizes)
- Publish to npm as `@wyld/kit` (public, free)
- `npm install @wyld/kit` in every repo, no more copying
- Trigger: 3+ consumers, shared code changes less than monthly
