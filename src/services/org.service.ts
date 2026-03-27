import type { AxiosInstance } from 'axios'

export interface Organization {
  id: string
  name: string
  slug: string
  type: 'school' | 'directory' | 'company'
  join_code: string | null
  logo_url: string | null
  stripe_customer_id: string | null
  subscription_status: string | null
  metadata: Record<string, unknown>
  is_active: boolean
}

export interface OrgMembership {
  id: string
  org_id: string
  user_id: string
  role: 'admin' | 'member'
  status: string
  metadata: Record<string, unknown>
  organization: Organization
}

export interface OrgPublicInfo {
  name: string
  type: string
  logo_url: string | null
}

/**
 * Organization API service. Pass your app's axios client.
 *
 * Usage:
 *   import client from '@/libs/HttpClients'
 *   const orgService = createOrgService(client)
 */
export function createOrgService(client: AxiosInstance) {
  return {
    async create(data: {
      name: string
      type: Organization['type']
      metadata?: Record<string, unknown>
    }): Promise<Organization> {
      const res = await client.post<{ status: string; data: Organization }>('/organizations', data)
      return res.data.data
    },

    async getByJoinCode(code: string): Promise<OrgPublicInfo> {
      const res = await client.get<{ status: string; data: OrgPublicInfo }>(`/organizations/join/${code}`)
      return res.data.data
    },

    async joinByCode(code: string): Promise<{ org: Organization; membership?: OrgMembership }> {
      const res = await client.post<{ status: string; data: { org: Organization; membership?: OrgMembership } }>(
        `/organizations/join/${code}`
      )
      return res.data.data
    },

    async getMyOrgs(type?: string): Promise<OrgMembership[]> {
      const params = type ? `?type=${type}` : ''
      const res = await client.get<{ status: string; data: OrgMembership[] }>(`/organizations/mine${params}`)
      return res.data.data
    },

    async updateMyMetadata(orgId: string, metadata: Record<string, unknown>): Promise<OrgMembership> {
      const res = await client.patch<{ status: string; data: OrgMembership }>(
        `/organizations/${orgId}/members/me`,
        { metadata }
      )
      return res.data.data
    },

    async uploadLogo(orgId: string, logoUrl: string): Promise<Organization> {
      const res = await client.post<{ status: string; data: Organization }>(
        `/organizations/${orgId}/logo`,
        { logo_url: logoUrl }
      )
      return res.data.data
    },

    async checkAccess(): Promise<{
      hasAccess: boolean
      source: 'individual' | 'organization' | null
      org?: Organization
    }> {
      const res = await client.get<{
        status: string
        data: { hasAccess: boolean; source: 'individual' | 'organization' | null; org?: Organization }
      }>('/organizations/access')
      return res.data.data
    },
  }
}

export type OrgService = ReturnType<typeof createOrgService>
