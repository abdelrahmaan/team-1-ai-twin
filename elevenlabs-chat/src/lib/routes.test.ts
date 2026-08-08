import { describe, expect, it } from 'vitest'
import { pathForRoute, routeForPath } from './routes'

describe('routeForPath', () => {
  it('maps /app to the app route', () => {
    expect(routeForPath('/app')).toBe('app')
  })

  it('maps / to the landing route', () => {
    expect(routeForPath('/')).toBe('landing')
  })

  it('falls back to landing for any unrecognized path', () => {
    expect(routeForPath('/whatever')).toBe('landing')
    expect(routeForPath('')).toBe('landing')
  })
})

describe('pathForRoute', () => {
  it('maps the app route to /app', () => {
    expect(pathForRoute('app')).toBe('/app')
  })

  it('maps the landing route to /', () => {
    expect(pathForRoute('landing')).toBe('/')
  })
})
