import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getNotifications, markRead, type Notification } from "@/api/notifications"
import { AlertTriangle, Clock, CheckCircle } from "lucide-react"

const typeConfig: Record<string, { label: string; variant: "default" | "destructive" | "warning" | "success"; icon: typeof Clock }> = {
  deadline_soon: { label: "скоро дедлайн", variant: "warning", icon: Clock },
  overdue: { label: "просрочка", variant: "destructive", icon: AlertTriangle },
  task_assigned: { label: "назначена задача", variant: "success", icon: CheckCircle },
  status_changed: { label: "статус изменён", variant: "default", icon: CheckCircle },
}

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])

  useEffect(() => { load().catch(() => {}) }, [])

  async function load() {
    const data = await getNotifications(true)
    setNotifications(data)
  }

  async function handleMarkRead(id: number) {
    await markRead(id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-heading text-h2">Уведомления</h1>
        <p className="text-muted-foreground text-sm mt-1">{notifications.length} непрочитанных</p>
      </div>

      {notifications.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">Нет уведомлений</CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {notifications.map((n) => {
          const cfg = typeConfig[n.type] || { label: n.type, variant: "secondary" as const, icon: Clock }
          const Icon = cfg.icon
          return (
            <Card key={n.id} className="cursor-pointer group hover:-translate-y-0.5 transition-all duration-200" onClick={() => handleMarkRead(n.id)}>
              <CardContent className="flex items-center gap-3 py-4">
                <div className="w-10 h-10 rounded-[10px] bg-black/[0.03] dark:bg-white/[0.03] border border-border flex items-center justify-center shrink-0">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm flex-1 text-foreground/90 group-hover:text-foreground transition-colors">{n.message}</p>
                <Badge variant={cfg.variant}>{cfg.label}</Badge>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
