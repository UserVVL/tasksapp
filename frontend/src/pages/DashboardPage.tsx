import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/AuthContext"
import { getWeeklyLists } from "@/api/weeklyLists"
import { getNotifications, markRead, type Notification } from "@/api/notifications"
import { AlertTriangle, CheckCircle, Clock, ListTodo, Play, Star, Coins, ArrowUpRight, FileText, ListChecks } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"

interface Stats {
  totalTasks: number
  pool: number
  inProgress: number
  review: number
  done: number
  overdue: number
  cancelled: number
}

const statConfig: Record<string, { label: string; color: string; glow: string; icon: typeof Clock }> = {
  totalTasks: { label: "Всего", color: "text-foreground", glow: "shadow-white/5", icon: ListTodo },
  pool: { label: "В пуле", color: "text-blue-400", glow: "glow-blue", icon: Play },
  inProgress: { label: "В работе", color: "text-orange-400", glow: "glow-warning", icon: Clock },
  review: { label: "На проверке", color: "text-purple-400", glow: "glow-purple", icon: Star },
  done: { label: "Выполнено", color: "text-green-400", glow: "glow-success", icon: CheckCircle },
  overdue: { label: "Просрочено", color: "text-red-400", glow: "shadow-red-500/10", icon: AlertTriangle },
  cancelled: { label: "Отменено", color: "text-muted-foreground", glow: "", icon: AlertTriangle },
}

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats>({ totalTasks: 0, pool: 0, inProgress: 0, review: 0, done: 0, overdue: 0, cancelled: 0 })
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => {
    getWeeklyLists().then((lists) => {
      const tasks = lists.flatMap((l) => l.tasks)
      setStats({
        totalTasks: tasks.length,
        pool: tasks.filter((t) => t.status === "pool").length,
        inProgress: tasks.filter((t) => t.status === "in_progress").length,
        review: tasks.filter((t) => t.status === "review").length,
        done: tasks.filter((t) => t.status === "done").length,
        overdue: tasks.filter((t) => t.status === "overdue").length,
        cancelled: tasks.filter((t) => t.status === "cancelled").length,
      })
    }).catch(() => {})
    getNotifications(true).then(setNotifications).catch(() => {})
  }, [])

  const isManager = user?.role === "director" || user?.role === "manager"
  const isWorker = user?.role === "painter" || user?.role === "admin"

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-h2 flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-y-2 sm:gap-x-2">
            <span>Добро пожаловать,</span>
            <span className="inline-flex items-center w-fit px-3 py-1 rounded-[14px] text-purple-400 border border-border bg-card-gradient shadow-card">
              {user?.full_name}
            </span>
          </h1>
          <p className="text-muted-foreground mt-1">Ваша панель управления задачами</p>
        </div>
        {(user?.role === "painter" || user?.role === "admin") && (
          <div className="flex items-center gap-3 px-5 py-3 rounded-[16px] bg-purple-500/5 border border-purple-500/10 glow-purple">
            <Coins className="h-5 w-5 text-purple-400" />
            <div>
              <p className="text-xs text-muted-foreground">Накоплено paint coins</p>
              <p className="font-mono text-2xl font-bold text-purple-300">{user?.score ?? 0}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {Object.entries(statConfig).map(([key, cfg]) => {
          const val = stats[key as keyof Stats]
          return (
            <Card key={key} className="relative overflow-hidden">
              <div className={`absolute inset-0 opacity-[0.03] ${cfg.glow}`} />
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{cfg.label}</CardTitle>
                <cfg.icon className={`h-4 w-4 ${cfg.color} opacity-70`} />
              </CardHeader>
              <CardContent className="pt-0">
                <div className={`font-mono text-3xl font-bold ${cfg.color}`}>{val}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {notifications.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Непрочитанные уведомления</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {notifications.slice(0, 4).map((n) => (
                <div
                  key={n.id}
                  onClick={async () => {
                    try { await markRead(n.id) } catch {}
                    if (isManager && (n.type === "review_ready" || n.type === "status_changed")) {
                      navigate("/review")
                    } else if (isWorker && n.type === "task_assigned") {
                      navigate("/my-tasks")
                    } else {
                      navigate("/weekly-lists")
                    }
                  }}
                  className="flex items-center gap-3 p-3 rounded-[12px] bg-black/[0.03] dark:bg-white/[0.03] border border-border cursor-pointer hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-all duration-200 min-h-[44px] group"
                >
                  {n.type === "overdue" ? (
                    <div className="w-9 h-9 rounded-[10px] bg-red-500/10 flex items-center justify-center shrink-0">
                      <AlertTriangle className="h-4 w-4 text-red-400" />
                    </div>
                  ) : n.type === "review_ready" ? (
                    <div className="w-9 h-9 rounded-[10px] bg-purple-500/10 flex items-center justify-center shrink-0">
                      <Star className="h-4 w-4 text-purple-400" />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-[10px] bg-yellow-500/10 flex items-center justify-center shrink-0">
                      <Clock className="h-4 w-4 text-yellow-400" />
                    </div>
                  )}
                  <p className="text-sm flex-1 min-w-0 text-foreground/90 group-hover:text-foreground transition-colors">{n.message}</p>
                  <Badge variant={n.type === "overdue" ? "destructive" : n.type === "review_ready" ? "default" : "warning"}>
                    {n.type === "overdue" ? "просрочка" : n.type === "review_ready" ? "на проверку" : "скоро дедлайн"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Быстрые действия</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Link
              to="/weekly-lists"
              className="group flex items-center justify-between p-4 rounded-[14px] bg-black/[0.03] dark:bg-white/[0.03] border border-border hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-all duration-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[10px] bg-purple-500/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Список задач</p>
                  <p className="text-xs text-muted-foreground">Просмотр и управление</p>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-purple-400 transition-colors" />
            </Link>
            {isWorker && (
              <Link
                to="/my-tasks"
                className="group flex items-center justify-between p-4 rounded-[14px] bg-black/[0.03] dark:bg-white/[0.03] border border-border hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[10px] bg-orange-500/10 flex items-center justify-center">
                    <Play className="h-5 w-5 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Мои задачи</p>
                    <p className="text-xs text-muted-foreground">Начать или завершить</p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-orange-400 transition-colors" />
              </Link>
            )}
            {isManager && (
              <Link
                to="/review"
                className="group flex items-center justify-between p-4 rounded-[14px] bg-black/[0.03] dark:bg-white/[0.03] border border-border hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[10px] bg-green-500/10 flex items-center justify-center">
                    <ListChecks className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Проверить задачи</p>
                    <p className="text-xs text-muted-foreground">Оценка и утверждение</p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-green-400 transition-colors" />
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
