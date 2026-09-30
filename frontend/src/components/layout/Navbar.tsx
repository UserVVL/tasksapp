import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { useTheme } from "@/contexts/ThemeContext"
import { Bell, LogOut, FileText, LayoutDashboard, Users, ListChecks, ClipboardCheck, Archive, Coins, Menu, X, Sun, Moon } from "lucide-react"

const ROLE_LABELS: Record<string, string> = {
  director: "Руководитель",
  manager: "Управляющий",
  admin: "Администратор",
  painter: "Маляр",
}

export function Navbar() {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  function handleLogout() {
    logout()
    navigate("/login")
  }

  const isManager = user?.role === "director" || user?.role === "manager"
  const isWorker = user?.role === "painter" || user?.role === "admin"

  const links = [
    { to: "/", label: "Дашборд", icon: LayoutDashboard, show: true },
    { to: "/weekly-lists", label: "Список задач", icon: FileText, show: true },
    { to: "/users", label: "Сотрудники", icon: Users, show: isManager },
    { to: "/my-tasks", label: "Мои задачи", icon: ClipboardCheck, show: isWorker },
    { to: "/review", label: "Проверка", icon: ListChecks, show: isManager },
    { to: "/archive", label: "Архив", icon: Archive, show: true },
  ]

  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl pt-[env(safe-area-inset-top)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-18 items-center">
          <div className="flex items-center gap-6">
            <button onClick={() => window.location.href = "/"} className="flex items-center gap-2 shrink-0 group cursor-pointer">
              <div className="w-12 h-12 rounded-[10px] bg-background flex items-center justify-center shadow-glow transition-all duration-200 group-hover:shadow-glow-lg p-1">
                <img src="/logo.png" alt="" className="w-full h-full object-contain" />
              </div>
              <span className="font-heading font-bold text-lg text-foreground">
                TextureTasks
              </span>
            </button>
            <div className="hidden md:flex items-center gap-1">
              {links.filter((l) => l.show).map((l) => {
                const isActive = location.pathname === l.to
                return (
                  <Link
                    key={l.to}
                    to={l.to}
                    className={`flex items-center gap-2 px-4 py-2 rounded-[12px] text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-black/10 dark:bg-white/10 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
                        : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    <l.icon className="h-4 w-4" />
                    {l.label}
                  </Link>
                )
              })}
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={toggle}
              className="p-2.5 rounded-[12px] text-muted-foreground hover:text-foreground hover:bg-white/5 dark:hover:bg-white/5 hover:bg-black/5 transition-all duration-200"
              title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <Link
              to="/notifications"
              className="relative p-2.5 rounded-[12px] text-muted-foreground hover:text-foreground hover:bg-white/5 dark:hover:bg-white/5 hover:bg-black/5 transition-all duration-200"
            >
              <Bell className="h-5 w-5" />
            </Link>
            <div className="flex items-center gap-3 pl-3 border-l border-border">
              <div className="text-right">
                <p className="text-sm font-medium text-foreground leading-tight">{user?.full_name}</p>
                <p className="text-xs text-muted-foreground">{ROLE_LABELS[user?.role ?? ""] ?? user?.role}</p>
              </div>
              {(user?.role === "painter" || user?.role === "admin") && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] bg-purple-500/10 border border-purple-500/20">
                  <Coins className="h-3.5 w-3.5 text-purple-400" />
                  <span className="font-mono text-sm font-semibold text-purple-300">{user?.score ?? 0}</span>
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex md:hidden items-center gap-2">
            {(user?.role === "painter" || user?.role === "admin") && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-purple-500/10 border border-purple-500/20">
                <Coins className="h-3 w-3 text-purple-400" />
                <span className="font-mono text-xs font-semibold text-purple-300">{user?.score ?? 0}</span>
              </div>
            )}
            <button
              onClick={toggle}
              className="p-2 rounded-[10px] text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-all"
              title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
            >
              {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <Link
              to="/notifications"
              className="p-2 rounded-[10px] text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-all"
            >
              <Bell className="h-5 w-5" />
            </Link>
            <Button variant="ghost" size="icon" className="min-w-[44px] min-h-[44px]" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
        {mobileOpen && (
          <div className="md:hidden border-t border-border pb-4 pt-2 space-y-1">
            <div className="px-3 py-2 text-sm text-muted-foreground">
              {user?.full_name} — {ROLE_LABELS[user?.role ?? ""] ?? user?.role}
            </div>
            {links.filter((l) => l.show).map((l) => {
              const isActive = location.pathname === l.to
              return (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-[12px] text-sm transition-all min-h-[44px] ${
                      isActive
                        ? "bg-black/10 dark:bg-white/10 text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                  }`}
                >
                  <l.icon className="h-4 w-4" />
                  {l.label}
                </Link>
              )
            })}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-3 rounded-[12px] text-sm text-red-400 hover:bg-red-500/10 w-full text-left transition-all min-h-[44px]"
            >
              <LogOut className="h-4 w-4" />
              Выйти
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
