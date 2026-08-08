import { useCallback, useEffect, useState } from 'react'
import { pathForRoute, routeForPath, type Route } from './lib/routes'
import { Assistant } from './pages/Assistant'
import { Landing } from './pages/Landing'

export default function App() {
  const [route, setRoute] = useState<Route>(() => routeForPath(window.location.pathname))

  useEffect(() => {
    const onPopState = () => setRoute(routeForPath(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((next: Route) => {
    window.history.pushState(null, '', pathForRoute(next))
    setRoute(next)
  }, [])

  if (route === 'app') return <Assistant />
  return <Landing onLaunch={() => navigate('app')} />
}
