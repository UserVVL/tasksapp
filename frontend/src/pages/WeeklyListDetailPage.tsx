import { useEffect, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/contexts/AuthContext"
import { getWeeklyList, type WeeklyList } from "@/api/weeklyLists"
import { createTask, updateTask, deleteTask, getTaskImages, ROOMS, STATUS_LABELS, type Task, type TaskImage } from "@/api/tasks"
import { get } from "@/api/client"
import {
  Plus,
  Trash2,
  Pencil,
  ArrowLeft,
  Calendar,
  Eye,
  User as UserIcon,
} from "lucide-react"

const nowMoscow = () => { const d = new Date(); const m = new Date(d.getTime() + 3 * 3600000); const y = m.getUTCFullYear(); const mo = String(m.getUTCMonth() + 1).padStart(2, '0'); const dd = String(m.getUTCDate()).padStart(2, '0'); const h = String(m.getUTCHours()).padStart(2, '0'); const mi = String(m.getUTCMinutes()).padStart(2, '0'); return `${y}-${mo}-${dd}T${h}:${mi}` }
const defaultDeadline = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 16)

interface Worker { id: number; full_name: string; role: string; is_active: boolean }

const statusMeta: Record<string, "default" | "success" | "warning" | "destructive" | "secondary" | "outline"> = {
  pool: "default", in_progress: "warning", review: "default", done: "success", overdue: "destructive", cancelled: "secondary",
}

export function WeeklyListDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [list, setList] = useState<WeeklyList | null>(null)
  const [workers, setWorkers] = useState<Worker[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [createRoom, setCreateRoom] = useState<string>(ROOMS[0])
  const [createOpen, setCreateOpen] = useState(false)
  const [createTitle, setCreateTitle] = useState("")
  const [createDescription, setCreateDescription] = useState("")
  const [createDeadline, setCreateDeadline] = useState(defaultDeadline)
  const [createAssignees, setCreateAssignees] = useState<number[]>([])

  const [editTask, setEditTask] = useState<Task | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editAssignees, setEditAssignees] = useState<number[]>([])
  const [editDeadline, setEditDeadline] = useState("")
  const [editOpen, setEditOpen] = useState(false)

  const [viewTask, setViewTask] = useState<Task | null>(null)
  const [viewOpen, setViewOpen] = useState(false)
  const [viewImages, setViewImages] = useState<TaskImage[]>([])
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const isManager = user?.role === "director" || user?.role === "manager"

  useEffect(() => {
    if (!id) return
    Promise.all([getWeeklyList(Number(id)), get("/users/")]).then(([l, users]) => {
      setList(l)
      setWorkers((users as Worker[]).filter((u) => u.is_active && (u.role === "painter" || u.role === "admin")))
      setIsLoading(false)
    }).catch(() => setIsLoading(false))
  }, [id])

  async function reload() { setList(await getWeeklyList(Number(id!))) }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    try {
      await createTask(Number(id), { title: createTitle, description: createDescription, room: createRoom, deadline: createDeadline, assignee_ids: createAssignees })
      setCreateTitle(""); setCreateDescription(""); setCreateDeadline(defaultDeadline); setCreateAssignees([]); setCreateOpen(false); reload()
    } catch (err) { alert("Ошибка: " + (err instanceof Error ? err.message : "")) }
  }

  function openEdit(task: Task) { setEditTask(task); setEditTitle(task.title); setEditDescription(task.description); setEditAssignees(task.assignees.map((a) => a.id)); setEditDeadline(task.deadline ?? ""); setEditOpen(true) }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editTask) return
    try { await updateTask(editTask.id, { title: editTitle, description: editDescription, assignee_ids: editAssignees, deadline: editDeadline || null }); setEditOpen(false); setEditTask(null); reload() }
    catch (err) { alert("Ошибка: " + (err instanceof Error ? err.message : "")) }
  }

  async function handleDelete(taskId: number) { if (!confirm("Удалить задачу?")) return; try { await deleteTask(taskId); reload() } catch (err) { alert("Ошибка: " + (err instanceof Error ? err.message : "")) } }

  if (isLoading) return <div className="animate-pulse h-40 bg-black/5 dark:bg-white/5 rounded-[20px]" />
  if (!list) return <div className="text-center py-12 text-muted-foreground">Список не найден</div>

  const openCreateForRoom = (room: string) => { setCreateRoom(room); setCreateTitle(""); setCreateDescription(""); setCreateDeadline(defaultDeadline); setCreateAssignees([]); setCreateOpen(true) }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4">
          <Link to="/weekly-lists" className="p-2.5 rounded-[12px] text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-all">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="font-heading text-h2">{list.title}</h1>
            <p className="text-muted-foreground flex items-center gap-1 text-sm mt-1">
              <Calendar className="h-4 w-4" /> {list.week_start} – {list.week_end}
            </p>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="w-[95vw] max-w-lg overflow-y-auto max-h-[90vh]">
          <DialogHeader><DialogTitle>Новая задача — {createRoom}</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3 sm:space-y-4">
            <div className="space-y-1 sm:space-y-2"><label className="text-xs sm:text-sm font-medium text-foreground">Название</label><Input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} required /></div>
            <div className="space-y-1 sm:space-y-2"><label className="text-xs sm:text-sm font-medium text-foreground">Описание</label><textarea value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} className="flex w-full rounded-[14px] border border-border bg-black/5 dark:bg-white/5 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:outline-none focus:border-purple-500/40 focus:shadow-[0_0_0_2px_rgba(139,92,246,0.15)] min-h-[80px]" /></div>
            <div className="space-y-1 sm:space-y-2"><label className="text-xs sm:text-sm font-medium text-foreground">Помещение</label>
              <Select value={createRoom} onValueChange={setCreateRoom}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ROOMS.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}</SelectContent></Select>
            </div>
            <div className="space-y-1 sm:space-y-2"><label className="text-xs sm:text-sm font-medium text-foreground">Срок</label>
              <div className="w-full overflow-hidden"><Input type="datetime-local" value={createDeadline} onChange={(e) => setCreateDeadline(e.target.value)} min={nowMoscow()} required /></div></div>
            <div className="space-y-1 sm:space-y-2"><label className="text-xs sm:text-sm font-medium text-foreground">Исполнители</label>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">{workers.map((w) => (<label key={w.id} className="flex items-center gap-1.5 sm:gap-2 px-2 py-1.5 sm:px-3 sm:py-2 rounded-[10px] bg-black/[0.03] dark:bg-white/[0.03] border border-border cursor-pointer hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-colors text-xs sm:text-sm"><input type="checkbox" checked={createAssignees.includes(w.id)} onChange={() => setCreateAssignees((p) => p.includes(w.id) ? p.filter((i) => i !== w.id) : [...p, w.id])} className="rounded border-border bg-black/5 dark:bg-white/5" />{w.full_name}</label>))}</div>
            </div>
            <Button type="submit" className="w-full">Создать</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="w-[95vw] max-w-lg overflow-y-auto max-h-[90vh]">
          <DialogHeader><DialogTitle>Редактировать задачу</DialogTitle></DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-3 sm:space-y-4">
            <div className="space-y-1 sm:space-y-2"><label className="text-xs sm:text-sm font-medium text-foreground">Название</label><Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required /></div>
            <div className="space-y-1 sm:space-y-2"><label className="text-xs sm:text-sm font-medium text-foreground">Описание</label><textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="flex w-full rounded-[14px] border border-border bg-black/5 dark:bg-white/5 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 transition-all focus:outline-none focus:border-purple-500/40 focus:shadow-[0_0_0_2px_rgba(139,92,246,0.15)] min-h-[80px]" /></div>
            <div className="space-y-1 sm:space-y-2"><label className="text-xs sm:text-sm font-medium text-foreground">Исполнители</label>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">{workers.map((w) => (<label key={w.id} className="flex items-center gap-1.5 sm:gap-2 px-2 py-1.5 sm:px-3 sm:py-2 rounded-[10px] bg-black/[0.03] dark:bg-white/[0.03] border border-border cursor-pointer hover:bg-black/[0.06] dark:hover:bg-white/[0.06] transition-colors text-xs sm:text-sm"><input type="checkbox" checked={editAssignees.includes(w.id)} onChange={() => setEditAssignees((p) => p.includes(w.id) ? p.filter((i) => i !== w.id) : [...p, w.id])} className="rounded border-border bg-black/5 dark:bg-white/5" />{w.full_name}</label>))}</div>
            </div>
            <div className="space-y-1 sm:space-y-2"><label className="text-xs sm:text-sm font-medium text-foreground">Срок</label>
              <div className="w-full overflow-hidden"><Input type="datetime-local" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} min={nowMoscow()} /></div></div>
            <Button type="submit" className="w-full">Сохранить</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader><DialogTitle>{viewTask?.title}</DialogTitle></DialogHeader>
          {viewTask && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{viewTask.room}</Badge>
                <Badge variant={statusMeta[viewTask.status] || "secondary"}>{STATUS_LABELS[viewTask.status]}</Badge>
              </div>
              {viewTask.description && <p className="text-sm text-muted-foreground">{viewTask.description}</p>}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><UserIcon className="h-3.5 w-3.5" /> {viewTask.assignees.length > 0 ? viewTask.assignees.map((a) => a.full_name).join(", ") : "Не назначены"}</span>
                {viewTask.deadline && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {viewTask.deadline.replace("T", " ").slice(0, 16)}</span>}
              </div>
              {viewImages.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Фото отчёта ({viewImages.length})</p>
                  <div className="flex flex-wrap gap-2">{viewImages.map((img) => (<button key={img.id} type="button" onClick={() => setPreviewImage(img.url)} className="w-20 h-20 rounded-[10px] overflow-hidden border border-border hover:opacity-80 transition-opacity"><img src={img.url} alt={img.original_name} className="w-full h-full object-cover" /></button>))}</div>
                </div>
              )}
              {viewTask.rating && <p className={`text-sm font-medium ${viewTask.rating < 0 ? 'text-red-400' : 'text-yellow-400'}`}>Оценка: {viewTask.rating > 0 ? `+${viewTask.rating}` : viewTask.rating}</p>}
              {viewTask.review_comment && <div className="bg-red-500/5 border border-red-500/10 p-3 rounded-[12px] text-sm"><p className="font-medium text-red-400">Причина:</p><p className="text-red-300/70 mt-1">{viewTask.review_comment}</p></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewImage} onOpenChange={(o) => !o && setPreviewImage(null)}>
        <DialogContent className="w-[95vw] max-w-2xl">
          <DialogHeader><DialogTitle>Фото</DialogTitle></DialogHeader>
          {previewImage && <img src={previewImage} alt="Фото" className="w-full h-auto rounded-[14px]" />}
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ROOMS.map((room) => {
          const tasks = list.tasks.filter((t) => t.room === room)
          const done = tasks.filter((t) => t.status === "done").length
          return (
            <Card key={room}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{room}</CardTitle>
                  {tasks.length > 0 && <Badge variant="secondary">{done}/{tasks.length}</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {tasks.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Нет задач</p>}
                {tasks.map((task) => {
                  const isOverdue = task.status === "overdue"
                  const isDone = task.status === "done"
                  return (
                    <div key={task.id} className={`p-3 rounded-[14px] border text-sm space-y-2 transition-all hover:-translate-y-0.5 ${isOverdue ? "border-red-500/20 bg-red-500/5" : isDone ? "border-green-500/20 bg-green-500/5" : "border-border bg-black/[0.02] dark:bg-white/[0.02]"}`}>
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 font-medium text-foreground">{task.title}</div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant={statusMeta[task.status] || "secondary"} className="text-[10px] px-1.5 py-0">{STATUS_LABELS[task.status]}</Badge>
                          <button onClick={async () => { setViewTask(task); setViewOpen(true); try { setViewImages(await getTaskImages(task.id)) } catch { setViewImages([]) } }} className="p-1.5 rounded-[8px] text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-all"><Eye className="h-3.5 w-3.5" /></button>
                          {isManager && (
                            <>
                              <button onClick={() => openEdit(task)} className="p-1.5 rounded-[8px] text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-all"><Pencil className="h-3.5 w-3.5" /></button>
                              <button onClick={() => handleDelete(task.id)} className="p-1.5 rounded-[8px] text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 className="h-3.5 w-3.5" /></button>
                            </>
                          )}
                        </div>
                      </div>
                      {task.description && <p className="text-muted-foreground text-xs line-clamp-2">{task.description}</p>}
                      {task.assignees.length > 0 && <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><UserIcon className="h-3 w-3" />{task.assignees.map((a) => a.full_name).join(", ")}</div>}
                      {task.deadline && <p className={`text-[11px] ${isOverdue ? "text-red-400 font-medium" : "text-muted-foreground"}`}>Срок: {task.deadline.replace("T", " ").slice(0, 16)}</p>}
                      {task.rating && <p className={`text-[11px] font-medium ${task.rating < 0 ? 'text-red-400' : 'text-yellow-400'}`}>Оценка: {task.rating > 0 ? `+${task.rating}` : task.rating}</p>}
                      {task.review_comment && <p className="text-[11px] text-muted-foreground italic">{task.review_comment}</p>}
                    </div>
                  )
                })}
                {isManager && (
                  <Button variant="secondary" size="default" className="w-full text-xs" onClick={() => openCreateForRoom(room)}>
                    <Plus className="h-3 w-3 mr-1" /> Добавить задачу
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
