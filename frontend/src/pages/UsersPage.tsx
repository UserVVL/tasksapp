import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/contexts/AuthContext"
import { get as apiGet, post, patch, del as apiDel } from "@/api/client"
import { Plus, ShieldCheck, UserCog, Users as UsersIcon, Wrench, Coins, ExternalLink, Eye, EyeOff, BarChart3, Trash2, RotateCcw, RefreshCw } from "lucide-react"

interface Worker {
  id: number
  username: string
  full_name: string
  role: "director" | "manager" | "admin" | "painter"
  is_active: boolean
  score: number
}

interface MonthlyScore {
  user_id: number
  full_name: string
  is_active: boolean
  months: { year: number; month: number; score: number }[]
}

const roleLabels: Record<string, string> = {
  director: "Руководитель",
  manager: "Управляющий",
  admin: "Администратор",
  painter: "Маляр",
}

const roleIcons: Record<string, React.ReactNode> = {
  director: <ShieldCheck className="h-4 w-4" />,
  manager: <UserCog className="h-4 w-4" />,
  admin: <UsersIcon className="h-4 w-4" />,
  painter: <Wrench className="h-4 w-4" />,
}

export function UsersPage() {
  const { user } = useAuth()
  const [workers, setWorkers] = useState<Worker[]>([])
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState<"painter" | "admin" | "manager">("painter")

  const [editWorker, setEditWorker] = useState<Worker | null>(null)
  const [editFullName, setEditFullName] = useState("")
  const [editRole, setEditRole] = useState<string>("")
  const [editPassword, setEditPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const [scoresOpen, setScoresOpen] = useState(false)
  const [monthlyScores, setMonthlyScores] = useState<MonthlyScore[]>([])

  useEffect(() => { load() }, [])

  useEffect(() => {
    const refresh = () => load()
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    const interval = setInterval(refresh, 30000)
    return () => {
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
      clearInterval(interval)
    }
  }, [])

  async function load() {
    try {
      const data = await apiGet<Worker[]>("/users/")
      setWorkers(data)
    } catch {}
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    try {
      await post("/auth/register", {
        username,
        password,
        full_name: fullName,
        role,
      })
      setUsername("")
      setPassword("")
      setFullName("")
      setRole("painter")
      setOpen(false)
      load()
    } catch (err) {
      alert("Ошибка при регистрации: " + (err instanceof Error ? err.message : "неизвестная ошибка"))
    }
  }

  async function handleDelete(w: Worker) {
    if (w.is_active) {
      if (!confirm(`Уволить ${w.full_name}? Он больше не сможет войти в систему.`)) return
      try {
        await apiDel(`/users/${w.id}`)
        load()
      } catch (err) {
        alert("Ошибка: " + (err instanceof Error ? err.message : "неизвестная ошибка"))
      }
    } else {
      await patch(`/users/${w.id}`, { is_active: true })
      load()
    }
  }

  function openEdit(w: Worker) {
    if (!w.is_active) return
    setEditWorker(w)
    setEditFullName(w.full_name)
    setEditRole(w.role)
    setEditPassword("")
    setShowPassword(false)
    setEditOpen(true)
  }

  function generatePassword() {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_-+=<>?"
    let pwd = ""
    for (let i = 0; i < 16; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length))
    return pwd
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    if (!editWorker) return
    try {
      const body: Record<string, unknown> = { full_name: editFullName }
      if (editRole !== editWorker.role) body.role = editRole
      if (editPassword) body.password = editPassword
      await patch(`/users/${editWorker.id}`, body)
      setEditOpen(false)
      setEditWorker(null)
      load()
    } catch (err) {
      alert("Ошибка при сохранении: " + (err instanceof Error ? err.message : "неизвестная ошибка"))
    }
  }

  const isManager = user?.role === "director" || user?.role === "manager"

  async function openScores() {
    try {
      const data = await apiGet<MonthlyScore[]>("/users/monthly-scores")
      setMonthlyScores(data)
      setScoresOpen(true)
    } catch (err) {
      alert("Ошибка: " + (err instanceof Error ? err.message : "неизвестная ошибка"))
    }
  }

  const allMonths = [...new Map(
    monthlyScores.flatMap((w) => w.months).map((m) => [`${m.year}-${m.month}`, m])
  ).values()].sort((a, b) => (a.year - b.year) || (a.month - b.month))

  if (!isManager) {
    return <div className="text-center py-12 px-4 text-muted-foreground">Доступно только руководителю и управляющему</div>
  }

  return (
    <div className="px-4 md:px-0 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-3xl font-bold">Сотрудники</h1>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={openScores} className="w-full sm:w-auto">
            <BarChart3 className="h-4 w-4 mr-2" /> Отчёт по месяцам
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Добавить сотрудника
            </Button>
          </DialogTrigger>
          <DialogContent className="w-[95vw] max-w-lg">
            <DialogHeader>
              <DialogTitle>Регистрация сотрудника</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Логин</label>
                <Input value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="painter_login" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Пароль</label>
                <div className="flex gap-2">
                  <Input value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="пароль" className="flex-1" />
                  <Button type="button" variant="outline" size="icon" className="min-w-[44px] min-h-[44px] shrink-0" onClick={() => setPassword(generatePassword())} title="Сгенерировать пароль">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">ФИО</label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Иванов Иван" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Должность</label>
                <Select value={role} onValueChange={(v: "painter" | "admin" | "manager") => setRole(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выберите должность" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="painter">Маляр</SelectItem>
                    <SelectItem value="admin">Администратор</SelectItem>
                    {user?.role === "director" && <SelectItem value="manager">Управляющий</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">Зарегистрировать</Button>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>Редактировать — {editWorker?.full_name}</DialogTitle>
          </DialogHeader>
          {editWorker && (
            <form onSubmit={handleEditSave} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Логин</label>
                <Input value={editWorker.username} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">ФИО</label>
                <Input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} required />
              </div>
              {user?.role === "director" || (user?.role === "manager" && editWorker.role !== "director") ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Должность</label>
                  <Select value={editRole} onValueChange={(v: string) => setEditRole(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="painter">Маляр</SelectItem>
                      <SelectItem value="admin">Администратор</SelectItem>
                      {user?.role === "director" && <SelectItem value="manager">Управляющий</SelectItem>}
                      {user?.role === "director" && <SelectItem value="director">Руководитель</SelectItem>}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="space-y-2">
                <label className="text-sm font-medium">Новый пароль (оставьте пустым, чтобы не менять)</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="оставьте пустым"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditPassword(generatePassword())}
                  className="text-xs text-primary hover:text-primary/80"
                >
                  Сгенерировать пароль
                </button>
              </div>

              <Button type="submit" className="w-full">Сохранить</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={scoresOpen} onOpenChange={setScoresOpen}>
        <DialogContent className="w-[95vw] max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Отчёт по месяцам</DialogTitle>
          </DialogHeader>
          {monthlyScores.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Нет данных</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4 font-medium">Сотрудник</th>
                    <th className="py-2 pr-4 font-medium">Статус</th>
                    {allMonths.map((m) => {
                      const date = new Date(m.year, m.month - 1)
                      const label = date.toLocaleDateString("ru-RU", { month: "short", year: "numeric" })
                      return <th key={`${m.year}-${m.month}`} className="py-2 pr-4 font-medium text-right">{label}</th>
                    })}
                    <th className="py-2 font-medium text-right">Итого</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyScores.map((w) => {
                    const total = w.months.reduce((s, m) => s + m.score, 0)
                    return (
                      <tr key={w.user_id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-2 pr-4">{w.full_name}</td>
                        <td className="py-2 pr-4">
                          <Badge variant={w.is_active ? "default" : "secondary"} className="text-[10px]">
                            {w.is_active ? "активен" : "архив"}
                          </Badge>
                        </td>
                        {allMonths.map((m) => {
                          const found = w.months.find((wm) => wm.year === m.year && wm.month === m.month)
                          return (
                            <td key={`${w.user_id}-${m.year}-${m.month}`} className="py-2 pr-4 text-right">
                              {found ? found.score : "-"}
                            </td>
                          )
                        })}
                        <td className="py-2 font-bold text-right text-amber-700">{total}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {workers.filter((w) => w.is_active).length > 0 && (
        <>
          <h2 className="text-lg font-semibold">Активные сотрудники</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workers.filter((w) => w.is_active).map((w) => {
              const canEdit = !(user?.role === "manager" && w.role === "director")
              return (
              <Card key={w.id} className={canEdit ? "cursor-pointer hover:shadow-md transition-shadow" : "opacity-60"} onClick={() => canEdit && openEdit(w)}>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {roleIcons[w.role]}
                    </div>
                    <div>
                      <CardTitle className="text-base">{w.full_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">@{w.username}</p>
                    </div>
                  </div>
                  <Badge variant={w.is_active ? "default" : "secondary"}>
                    {w.is_active ? "активен" : "неактивен"}
                  </Badge>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{roleLabels[w.role]}</Badge>
                    {(w.role === "painter" || w.role === "admin") && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded" title="Баллы за текущий месяц">
                        <Coins className="h-3 w-3 text-purple-400" />
                        {w.score}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {canEdit && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(w) }}
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                      title="Уволить"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    )}
                    {canEdit ? <ExternalLink className="h-4 w-4 text-muted-foreground" /> : null}
                  </div>
                </CardContent>
              </Card>
              )
            })}
          </div>
        </>
      )}

      {workers.filter((w) => !w.is_active).length > 0 && (
        <>
          <div className="border-t pt-6 mt-6">
            <h2 className="text-lg font-semibold text-muted-foreground">Архивные сотрудники</h2>
            <p className="text-xs text-muted-foreground mb-3">Уволенные сотрудники, данные сохранены</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-70">
            {workers.filter((w) => !w.is_active).map((w) => (
              <Card key={w.id} className="">
                <CardHeader className="flex flex-row items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      {roleIcons[w.role]}
                    </div>
                    <div>
                      <CardTitle className="text-base text-muted-foreground">{w.full_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">@{w.username}</p>
                    </div>
                  </div>
                  <Badge variant="secondary">архив</Badge>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{roleLabels[w.role]}</Badge>
                    {(w.role === "painter" || w.role === "admin") && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded" title="Баллы за текущий месяц">
                        <Coins className="h-3 w-3 text-purple-400" />
                        {w.score}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(w) }}
                      className="p-2 text-muted-foreground hover:text-primary transition-colors"
                      title="Восстановить"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
