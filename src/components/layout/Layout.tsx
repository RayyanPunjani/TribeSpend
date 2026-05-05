import { useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function Layout({ children }: { children?: ReactNode }) {
  const { pathname } = useLocation()
  const useDocumentScroll = pathname.startsWith('/app/transactions')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <div className={`flex bg-slate-50 ${useDocumentScroll ? 'min-h-screen' : 'h-screen overflow-hidden'}`}>
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-950/45"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative h-full w-72 max-w-[86vw] shadow-2xl">
            <Sidebar mobile onNavigate={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      )}

      <div className={`flex-1 flex flex-col min-w-0 ${useDocumentScroll ? '' : 'overflow-hidden'}`}>
        <TopBar onMenuClick={() => setMobileSidebarOpen(true)} />
        <main className={`flex-1 p-3 sm:p-4 lg:p-6 ${useDocumentScroll ? 'overflow-visible' : 'overflow-auto'}`}>
          {children}
        </main>
      </div>
    </div>
  )
}
