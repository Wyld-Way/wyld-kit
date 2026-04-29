# @wyld/kit

Shared hooks, components, and services for the Wyld Way ecosystem.

## How it works

Real package. Consumers install from this GitHub repo:

```json
{
  "dependencies": {
    "@wyld/kit": "github:Wyld-Way/wyld-kit#main"
  }
}
```

Then in `next.config.{ts,js}`:

```ts
const nextConfig = {
  transpilePackages: ['@wyld/kit'],
  // ...
}
```

Kit ships raw TypeScript; Next.js compiles it via SWC at consumer build time.

## Imports — subpath, not root

The kit re-exports everything from `src/index.ts`, but importing from the root pulls every peer dep transitively. **Use subpath imports** so each consumer pulls only the surfaces it needs.

| Subpath | What you get | Peer deps it activates |
|---------|--------------|------------------------|
| `@wyld/kit/auth` | `createAuthService` + types | `axios` |
| `@wyld/kit/s3` | `createS3UploadService`, `FOLDERS` | (none — uses consumer's `aws-sdk` lazily) |
| `@wyld/kit/org` | `createOrgService` + types | `axios` |
| `@wyld/kit/hooks/use-require-auth` | `useRequireAuth` | `react`, `next` |
| `@wyld/kit/hooks/use-org` | `createOrgHooks` | `@tanstack/react-query` |
| `@wyld/kit/components/address-autocomplete` | `AddressAutocomplete` (default) + types | `@mapbox/mapbox-sdk` |

`mapbox-sdk`, `react-query`, and `react-toastify` are declared as **optional** peer deps (`peerDependenciesMeta`), so consumers that don't import those subpaths don't have to install them.

## Updating the kit

```bash
cd packages/wyld-kit
# edit src/, update exports map in package.json if you added a subpath
git add . && git commit && git push origin main
```

Consumers don't auto-rebuild on kit push. To pull the new commit per consumer:

```bash
cd <consumer-repo>
npm update @wyld/kit
git add package-lock.json && git commit -m "chore(kit): bump @wyld/kit" && git push
```

Vercel deploys the consumer with the new lockfile-pinned commit hash.

## What's inside

| Subpath | Type | What it does |
|---|---|---|
| `auth` | Factory | Login (email/pw, Google, Apple), forgot/reset, fetchMe, fetchMeFull, logout |
| `s3` | Factory | S3 direct browser upload with graceful degradation when AWS env unset |
| `org` | Factory | Org CRUD (create, join, list, update, members) |
| `hooks/use-require-auth` | Hook | Auth guard — redirects if not authenticated |
| `hooks/use-org` | Hook factory | React Query hooks for orgs |
| `components/address-autocomplete` | Component | Mapbox address search with dropdown |

## Usage

### Auth guard

```tsx
import { useAuth } from '@/lib/auth'
import { useRequireAuth } from '@wyld/kit/hooks/use-require-auth'

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
import { createOrgService } from '@wyld/kit/org'
import { createOrgHooks } from '@wyld/kit/hooks/use-org'

const orgService = createOrgService(client)
export const { useMySchool, useCreateOrg, useJoinOrg } = createOrgHooks(orgService)
```

### Auth service

```tsx
// src/lib/api/user-auth.ts (create once per app)
import http, { setStoredToken } from './http-client'
import { createAuthService } from '@wyld/kit/auth'

const auth = createAuthService(http, {
  storage: { setToken: setStoredToken },
})

export const {
  login, googleLogin, appleLogin,
  forgotPassword, resetPassword,
  fetchMe, fetchMeFull, logout,
} = auth
```

Apps can wrap to add localStorage user persistence or app-specific behavior. The kit doesn't assume how each app persists session state — pass a storage adapter or skip it.

### S3 upload

```tsx
import { createS3UploadService, FOLDERS } from '@wyld/kit/s3'

const uploader = createS3UploadService({
  region: process.env.NEXT_PUBLIC_AWS_S3_REGION_NAME,
  accessKeyId: process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY,
  bucket: process.env.NEXT_PUBLIC_AWS_STORAGE_BUCKET_NAME,
})

if (uploader.isConfigured) {
  const filename = await uploader.upload(file, FOLDERS.GUIDE_COVER)
  // filename is what you save to the backend, not the full URL
}
```

`isConfigured` is `false` when any AWS env value is missing — UI should hide the upload affordance, NOT throw. `aws-sdk` lazy-imports inside `upload()` so the bundle only ships when actually used.

### Address autocomplete

```tsx
import AddressAutocomplete, { type LocationResult } from '@wyld/kit/components/address-autocomplete'

<AddressAutocomplete
  value={address}
  onChange={setAddress}
  onSelect={(result: LocationResult) => {
    // result: { address, lat, lng, country }
  }}
  inputClassName="your-tailwind-classes"
  placeholder="Type your address"
/>
```

Requires `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` env var, or pass `mapboxToken` prop.

## Design principles

- **Factory pattern**: services and hooks take the consumer's axios client. No singletons.
- **No build step**: consumed as TypeScript source. Consumer's bundler compiles it.
- **Styling**: components accept className props. No hardcoded brand colors.
- **Surgical imports**: every shared piece is its own subpath so peer deps stay isolated.

## Current consumers

- `Wyld-Way/kripa` — 5 tenant Vercel projects (kripa, earthbased, rewyld-directory, theforesttherapyschool, kripalu-alumni). Uses `@wyld/kit/auth` + `@wyld/kit/s3`.
- `Wyld-Way/nature-class` (Schools) — uses `@wyld/kit/hooks/use-require-auth` + `@wyld/kit/components/address-autocomplete`.

## History

Pre-2026-04-29 the kit was mirrored as embedded copies in each consumer (`src/lib/wyld-kit/`) with a manual `cp` sync. The 2026-04-29 migration converted it to a real package: subpath exports + optional peer deps + public repo. Drift class eliminated.
