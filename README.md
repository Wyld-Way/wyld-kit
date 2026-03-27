# @wyld/kit

Shared hooks, components, and services for the Wyld Way ecosystem. Used by Rewyld, Schools, and future products.

## Install

In any sibling repo's `package.json`, add:

```json
{
  "dependencies": {
    "@wyld/kit": "file:../packages/wyld-kit"
  }
}
```

Then `npm install`. For Schools (one level deeper):

```json
"@wyld/kit": "file:../../packages/wyld-kit"
```

## What's inside

| Export | Type | What it does |
|--------|------|-------------|
| `useRequireAuth` | Hook | Auth guard - redirects if not authenticated |
| `createOrgService` | Factory | Org API service (create, join, list, update) |
| `createOrgHooks` | Factory | React Query hooks for orgs |
| `AddressAutocomplete` | Component | Mapbox address search with dropdown |

## Usage

### Auth guard

```tsx
import { useAuth } from '@/lib/auth'
import { useRequireAuth } from '@wyld/kit'

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
import client from '@/libs/HttpClients'
import { createOrgService, createOrgHooks } from '@wyld/kit'

// Create once per app (e.g. in a shared file)
const orgService = createOrgService(client)
export const { useMySchool, useCreateOrg, useJoinOrg } = createOrgHooks(orgService)
```

### Address autocomplete

```tsx
import { AddressAutocomplete } from '@wyld/kit'

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

## Design principles

- **Factory pattern**: Services and hooks take your app's axios client. No global config, no singleton.
- **Peer dependencies**: React, React Query, Axios are peer deps. Your app provides them.
- **No build step**: Consumed as TypeScript source via `file:` references. Your app's bundler compiles it.
- **Styling**: Components accept className props. No hardcoded brand colors.
