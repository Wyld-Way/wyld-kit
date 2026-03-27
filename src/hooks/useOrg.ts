import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { OrgService, Organization, OrgMembership, OrgPublicInfo } from '../services/org.service'

/**
 * React Query hooks for the org model. Pass a service instance.
 *
 * Usage:
 *   const orgService = createOrgService(client)
 *   const { useMyOrgs, useCreateOrg, ... } = createOrgHooks(orgService)
 */
export function createOrgHooks(service: OrgService) {
  function useMyOrgs(type?: string) {
    return useQuery<OrgMembership[]>({
      queryKey: ['organizations', 'mine', type],
      queryFn: () => service.getMyOrgs(type),
      retry: false,
    })
  }

  function useMySchool() {
    return useQuery<OrgMembership | null>({
      queryKey: ['organizations', 'mine', 'school'],
      queryFn: async () => {
        const orgs = await service.getMyOrgs('school')
        return orgs.length > 0 ? orgs[0] : null
      },
      retry: false,
    })
  }

  function useOrgByJoinCode(code: string | null) {
    return useQuery<OrgPublicInfo>({
      queryKey: ['organizations', 'join', code],
      queryFn: () => service.getByJoinCode(code!),
      enabled: !!code,
      retry: false,
    })
  }

  function useCreateOrg(options?: {
    onSuccess?: (org: Organization) => void
    onError?: (error: unknown) => void
  }) {
    const queryClient = useQueryClient()
    return useMutation({
      mutationFn: service.create,
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ['organizations'] })
        options?.onSuccess?.(data)
      },
      onError: options?.onError,
    })
  }

  function useJoinOrg(options?: {
    onSuccess?: (data: { org: Organization; membership?: OrgMembership }) => void
    onError?: (error: unknown) => void
  }) {
    const queryClient = useQueryClient()
    return useMutation({
      mutationFn: (code: string) => service.joinByCode(code),
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ['organizations'] })
        options?.onSuccess?.(data)
      },
      onError: options?.onError,
    })
  }

  function useUpdateMyMetadata(options?: {
    onSuccess?: (data: OrgMembership) => void
    onError?: (error: unknown) => void
  }) {
    const queryClient = useQueryClient()
    return useMutation({
      mutationFn: ({ orgId, metadata }: { orgId: string; metadata: Record<string, unknown> }) =>
        service.updateMyMetadata(orgId, metadata),
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ['organizations'] })
        options?.onSuccess?.(data)
      },
      onError: options?.onError,
    })
  }

  return {
    useMyOrgs,
    useMySchool,
    useOrgByJoinCode,
    useCreateOrg,
    useJoinOrg,
    useUpdateMyMetadata,
  }
}
