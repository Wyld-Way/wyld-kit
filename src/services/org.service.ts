import type { AxiosInstance } from 'axios'

export type OrgType = 'school' | 'directory' | 'company' | 'training_institution'

export interface Organization {
  id: string
  name: string
  slug: string
  type: OrgType
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

export type OrgGuideStatus = 'pending' | 'approved' | 'rejected'

export interface OrgGuideLink {
  id: string
  org_id: string
  guide_id: string
  status: OrgGuideStatus
  is_featured: boolean
  position: number | null
  requested_at: string
  reviewed_at: string | null
  reviewed_by_user_id: string | null
  rejection_reason: string | null
  featured_at: string | null
  guide?: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    profile_photo: string | null
    guidUser: {
      id: string
      profile_name: string | null
      slug: string | null
      cover_image: string | null
      address: string | null
      about: string | null
      skills: string[]
      certifications: string[]
      is_verified: boolean
    } | null
  }
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

    // ─── Institution guide management (slug-scoped) ───

    async requestOrgGuide(slug: string): Promise<OrgGuideLink> {
      const res = await client.post<{ status: string; data: OrgGuideLink }>(
        `/organizations/slug/${slug}/guides/request`
      )
      return res.data.data
    },

    async listOrgGuides(slug: string, status?: OrgGuideStatus): Promise<OrgGuideLink[]> {
      const params = status ? `?status=${status}` : ''
      const res = await client.get<{ status: string; data: OrgGuideLink[] }>(
        `/organizations/slug/${slug}/guides${params}`
      )
      return res.data.data
    },

    async approveOrgGuide(slug: string, guideUserId: string): Promise<OrgGuideLink> {
      const res = await client.post<{ status: string; data: OrgGuideLink }>(
        `/organizations/slug/${slug}/guides/${guideUserId}/approve`
      )
      return res.data.data
    },

    async rejectOrgGuide(
      slug: string,
      guideUserId: string,
      rejectionReason?: string
    ): Promise<OrgGuideLink> {
      const res = await client.post<{ status: string; data: OrgGuideLink }>(
        `/organizations/slug/${slug}/guides/${guideUserId}/reject`,
        { rejection_reason: rejectionReason }
      )
      return res.data.data
    },

    async setOrgGuideFeatured(
      slug: string,
      guideUserId: string,
      isFeatured: boolean
    ): Promise<OrgGuideLink> {
      const res = await client.patch<{ status: string; data: OrgGuideLink }>(
        `/organizations/slug/${slug}/guides/${guideUserId}/featured`,
        { is_featured: isFeatured }
      )
      return res.data.data
    },

    async updateOrgProfile(
      slug: string,
      patch: { name?: string; logo_url?: string; metadata?: Record<string, unknown> }
    ): Promise<Organization> {
      const res = await client.patch<{ status: string; data: Organization }>(
        `/organizations/slug/${slug}`,
        patch
      )
      return res.data.data
    },
  }
}

export type OrgService = ReturnType<typeof createOrgService>
