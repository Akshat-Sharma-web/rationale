import { useState, useEffect, useRef } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { Sidebar } from './Sidebar'

/**
 * AppShell wraps all protected pages.
 * - Desktop: fixed 240px sidebar + scrollable main content
 * - Mobile: sidebar hidden by default, hamburger toggle opens it
 *   as an overlay with a click-outside / close-button dismiss.
 */
export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close sidebar when viewport grows past mobile breakpoint
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setSidebarOpen(false)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  return (
    <div className="app-shell">
      {/* ── Mobile overlay backdrop ───────────────────────── */}
      {sidebarOpen && (
        <div
          ref={overlayRef}
          className="app-shell__overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ───────────────────────────────────────── */}
      <div className={`app-shell__sidebar ${sidebarOpen ? 'app-shell__sidebar--open' : ''}`}>
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* ── Main area ─────────────────────────────────────── */}
      <div className="app-shell__main">
        {/* Mobile header bar with hamburger */}
        <div className="app-shell__mobile-bar">
          <button
            className="app-shell__hamburger"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
            id="btn-hamburger"
          >
            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <span className="app-shell__mobile-logo">Rationale</span>
        </div>

        {/* Page content rendered by nested routes */}
        <main className="app-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
