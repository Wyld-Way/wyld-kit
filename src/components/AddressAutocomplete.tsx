'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
// @ts-expect-error -- mapbox sdk lacks types
import mbxGeocoding from '@mapbox/mapbox-sdk/services/geocoding'

interface MapboxFeature {
  id: string
  place_name: string
  center: [number, number] // [lng, lat]
  context?: Array<{ id: string; text: string; short_code?: string }>
}

export interface LocationResult {
  address: string
  lat: number
  lng: number
  country: string // ISO 3166-1 alpha-2 (e.g. "GB", "US")
}

export interface AddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelect: (result: LocationResult) => void
  placeholder?: string
  /** Mapbox access token. Falls back to NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN env var. */
  mapboxToken?: string
  /** Mapbox geocoding types to search. Default: poi, address, place, postcode, locality */
  types?: string[]
  /** CSS classes for the input element */
  inputClassName?: string
  /** CSS classes for the dropdown container */
  dropdownClassName?: string
  /** CSS classes for each suggestion item */
  itemClassName?: string
  /** CSS classes for the wrapper div */
  className?: string
  /** Error message to display */
  error?: string
}

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Start typing an address...',
  mapboxToken: tokenProp,
  types = ['poi', 'address', 'place', 'postcode', 'locality'],
  inputClassName = '',
  dropdownClassName = '',
  itemClassName = '',
  className = '',
  error,
}: AddressAutocompleteProps) {
  const token = tokenProp || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
  const clientRef = useRef(token ? mbxGeocoding({ accessToken: token }) : null)

  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const search = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!query || query.length < 3 || !clientRef.current) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true)
      try {
        const res = await clientRef.current!
          .forwardGeocode({ query, autocomplete: true, limit: 5, types })
          .send()
        setSuggestions(res.body.features || [])
        setShowSuggestions(true)
      } catch (err: unknown) {
        const error = err as { name?: string }
        if (error?.name !== 'AbortError') console.error('Mapbox geocoding error:', err)
      } finally {
        setIsLoading(false)
      }
    }, 300)
  }, [types])

  const handleSelect = (feature: MapboxFeature) => {
    const [lng, lat] = feature.center
    const countryCtx = feature.context?.find((c) => c.id.startsWith('country'))
    const country = countryCtx?.short_code?.toUpperCase() || ''

    onChange(feature.place_name)
    onSelect({ address: feature.place_name, lat, lng, country })
    setSuggestions([])
    setShowSuggestions(false)
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); search(e.target.value) }}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
        placeholder={placeholder}
        className={inputClassName}
      />

      {isLoading && (
        <div className="absolute right-0 top-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <div className={`absolute z-50 mt-1 w-full rounded-xl bg-white shadow-lg border border-gray-200 overflow-hidden ${dropdownClassName}`}>
          {suggestions.map((feature) => (
            <button
              key={feature.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(feature)}
              className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 ${itemClassName}`}
            >
              {feature.place_name}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  )
}
