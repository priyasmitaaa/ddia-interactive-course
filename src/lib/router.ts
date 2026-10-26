import { useEffect, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'lesson'; id: string }
  | { name: 'review' }
  | { name: 'practice'; id?: string }
  | { name: 'progress' };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  switch (parts[0]) {
    case 'lesson': return parts[1] ? { name: 'lesson', id: parts[1] } : { name: 'home' };
    case 'review': return { name: 'review' };
    case 'practice': return { name: 'practice', id: parts[1] };
    case 'progress': return { name: 'progress' };
    default: return { name: 'home' };
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => { setRoute(parseHash(window.location.hash)); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const go = (hash: string) => { window.location.hash = hash; };
