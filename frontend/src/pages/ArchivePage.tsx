import { useEffect, useState } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getArchive, getTaskImages, STATUS_LABELS, type Task, type TaskImage } from "@/api/tasks"
import { get } from "@/api/client"
import { Calendar, User as UserIcon, Star, Search, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Worker {
  id: number
  full_name: string
}

const statusMeta: Record<string, { label: string; variant: "success" | "destructive" | "secondary" }> = {
  done: { label: "Выполнено", variant: "success" },
  overdue: { label: "Просрочено", variant: "destructive" },
  cancelled: { label: "Отменено", variant: "secondary" },
}

export function ArchivePage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterAssignee, setFilterAssignee] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [images, setImages] = useState<Record<number, TaskImage[]>>({})
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  useEffect(() => {
    getArchive().then(async (ts) => {
      setTasks(ts)
      const imgs: Record<number, TaskImage[]> = {}
      await Promise.all(ts.map(async (t) => {
        try { const taskImgs = await getTaskImages(t.id); if (taskImgs.length > 0) imgs[t.id] = taskImgs } catch {}
      }))
      setImages(imgs)
    }).catch(() => {})
    get<Worker[]>("/users/").then((u) => setWorkers(u)).catch(() => {})
  }, [])

  const filtered = tasks.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false
    if (filterAssignee !== "all") { const id = Number(filterAssignee); if (!t.assignees.some((a) => a.id === id)) return false }
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    const completed = t.completed_at ? t.completed_at.split("T")[0] : null
    if (dateFrom && completed && completed < dateFrom) return false
    if (dateTo && completed && completed > dateTo) return false
    return true
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-heading text-h2">Архив задач</h1>
        <p className="text-muted-foreground text-sm mt-1">{filtered.length} задач</p>
      </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
          <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9 w-full" placeholder="Поиск по названию..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full sm:w-auto">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                <SelectItem value="done">Выполнено</SelectItem>
                <SelectItem value="overdue">Просрочено</SelectItem>
                <SelectItem value="cancelled">Отменено</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterAssignee} onValueChange={setFilterAssignee}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Все работники" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все работники</SelectItem>
                {workers.map((w) => (<SelectItem key={w.id} value={String(w.id)}>{w.full_name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch gap-3 w-full sm:w-auto">
            <div className="space-y-1 w-full sm:w-auto">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Дата с</label>
              <div className="flex items-center gap-1">
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full sm:w-36" />
                {dateFrom && (
                  <button onClick={() => setDateFrom("")} className="p-1.5 rounded-[8px] text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-all shrink-0" title="Очистить">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-1 w-full sm:w-auto">
              <label className="text-xs text-muted-foreground whitespace-nowrap">Дата по</label>
              <div className="flex items-center gap-1">
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full sm:w-36" />
                {dateTo && (
                  <button onClick={() => setDateTo("")} className="p-1.5 rounded-[8px] text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-all shrink-0" title="Очистить">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

      {filtered.length === 0 && (
        <Card><CardContent className="py-16 text-center text-muted-foreground">Нет задач в архиве</CardContent></Card>
      )}

      <div className="space-y-2">
        {filtered.map((task) => (
          <Card key={task.id} className="group hover:-translate-y-0.5 transition-all duration-200">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-base">{task.title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">{task.room}</p>
                </div>
                <Badge variant={statusMeta[task.status]?.variant || "secondary"}>{STATUS_LABELS[task.status]}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" /> {task.assignees.map((a) => a.full_name).join(", ") || "—"}</span>
                {task.deadline && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {task.deadline.replace("T", " ").slice(0, 16)}</span>}
                {task.completed_at && <span className="flex items-center gap-1 text-xs">Завершено: {task.completed_at.split("T")[0]}</span>}
                {task.rating && <span className={`flex items-center gap-1 ${task.rating < 0 ? 'text-red-400' : 'text-yellow-400'}`}><Star className="h-3 w-3" /> {task.rating > 0 ? `+${task.rating}` : task.rating}</span>}
                {task.review_comment && <span className="text-muted-foreground">Причина: {task.review_comment}</span>}
              </div>
              {images[task.id] && images[task.id].length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {images[task.id].map((img) => (
                    <button key={img.id} type="button" onClick={() => setPreviewImage(img.url)} className="w-14 h-14 rounded-[10px] overflow-hidden border border-border hover:opacity-80 transition-opacity">
                      <img src={img.url} alt={img.original_name} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!previewImage} onOpenChange={(o) => !o && setPreviewImage(null)}>
        <DialogContent className="w-[95vw] max-w-2xl">
          <DialogHeader><DialogTitle>Фото</DialogTitle></DialogHeader>
          {previewImage && <img src={previewImage} alt="Фото" className="w-full h-auto rounded-[14px]" />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
