import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest, initializeCsrf } from '../../api/client'

afterEach(() => {
  vi.unstubAllGlobals()
  document.cookie = 'XSRF-TOKEN=; Max-Age=0; Path=/'
})

describe('Cookie-based API client', () => {
  it('includes credentials and a decoded CSRF cookie on write requests', async () => {
    document.cookie = 'XSRF-TOKEN=encoded%2Btoken; Path=/'
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    await apiRequest('/logout', { method: 'POST' })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/logout')
    expect(options.credentials).toBe('include')
    expect(options.headers.get('X-XSRF-TOKEN')).toBe('encoded+token')
  })

  it('initializes CSRF on the API origin', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)
    await initializeCsrf()
    expect(fetchMock.mock.calls[0][0]).toBe(`${window.location.origin}/sanctum/csrf-cookie`)
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include')
  })

  it('preserves field validation errors and does not retry automatically', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: { email: ['Invalid credentials.'] } }), { status: 422 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(apiRequest('/login', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 422, errors: { email: ['Invalid credentials.'] } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reports a connection failure as a recoverable API error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network unavailable')))
    await expect(apiRequest('/user')).rejects.toBeInstanceOf(ApiError)
  })
})
