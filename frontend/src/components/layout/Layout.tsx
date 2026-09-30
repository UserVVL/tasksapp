import { Outlet, Navigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"
import { Navbar } from "./Navbar"

export function Layout() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-[12px] bg-primary-gradient animate-glow-pulse flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-border/30 border-t-border rounded-full animate-spin" />
          </div>
          <p className="text-sm text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 pointer-events-none bg-glow-purple" />
      <div className="fixed inset-0 pointer-events-none bg-glow-pink" />
      <Navbar />
      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
        <Outlet />
      </main>
    </div>
  )
}
