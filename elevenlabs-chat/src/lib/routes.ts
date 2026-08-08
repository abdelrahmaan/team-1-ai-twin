export type Route = 'landing' | 'app'

export function routeForPath(pathname: string): Route {
  return pathname === '/app' ? 'app' : 'landing'
}

export function pathForRoute(route: Route): string {
  return route === 'app' ? '/app' : '/'
}
