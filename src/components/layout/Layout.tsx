import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function Layout({ children }: { children?: ReactNode }) {
  const { pathname } = useLocation()
  const useDocumentScroll = pathname === '/app/transactions'

  return (
    <div className={`flex bg-slate-50 ${useDocumentScroll ? 'min-h-screen' : 'h-screen overflow-hidden'}`}>
      <Sidebar />
      <div className={`flex-1 flex flex-col min-w-0 ${useDocumentScroll ? '' : 'overflow-hidden'}`}>
        <TopBar />
        <main className={`flex-1 p-6 ${useDocumentScroll ? '' : 'overflow-auto'}`}>
          {children}
        </main>
      </div>
    </div>
  )
}
