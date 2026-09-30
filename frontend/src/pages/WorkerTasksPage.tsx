import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/contexts/AuthContext"
import { getTasks, startTask, completeTask, cancelTask, getTaskImages, uploadTaskImage, deleteTaskImage, STATUS_LABELS, type Task, type TaskImage } from "@/api/tasks"
import { Play, CheckCircle, XCircle, Calendar, Image as ImageIcon, Loader2, X } from "lucide-react"

const statusMeta: Record<string, { variant: "default" | "success" | "warning" | "destructive" | "secondary"; dot: string }> = {
  pool: { variant: "default", dot: "bg-purple-400" },
  in_progress: { variant: "warning", dot: "bg-orange-400" },
  review: { variant: "secondary", dot: "bg-blue-400" },
  done: { variant: "success", dot: "bg-green-400" },
  overdue: { variant: "destructive", dot: "bg-red-400" },
  cancelled: { variant: "secondary", dot: "bg-muted-foreground" },
}

export function WorkerTasksPage() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelComment, setCancelComment] = useState("")
  const [images, setImages] = useState<TaskImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  useEffect(() => {
    if (user) getTasks({ assignee_id: user.id }).then(setTasks).catch(() => {})
  }, [user])

  async function refresh() { if (user) getTasks({ assignee_id: user.id }).then(setTasks) }
  async function handleStart(taskId: number) { await startTask(taskId); refresh() }
  async function handleComplete(taskId: number) { await completeTask(taskId); setDetailOpen(false); refresh() }
  async function handleDeleteImage(img: TaskImage) { if (!selectedTask || !confirm(`Удалить фото "${img.original_name}"?`)) return; try { await deleteTaskImage(selectedTask.id, img.id); setImages((prev) => prev.filter((i) => i.id !== img.id)) } catch (err) { alert("Ошибка: " + (err instanceof Error ? err.message : "неизвестная ошибка")) } }
  async function handleCancel(taskId: number) { await cancelTask(taskId, cancelComment); setCancelOpen(false); setDetailOpen(false); setCancelComment(""); refresh() }
  async function openDetail(task: Task) { setSelectedTask(task); setDetailOpen(true); try { setImages(await getTaskImages(task.id)) } catch { setImages([]) } }

  const grouped: Record<string, Task[]> = { pool: [], in_progress: [], review: [], done: [], overdue: [], cancelled: [] }
  for (const t of tasks) grouped[t.status]?.push(t)

  const sections = [
    { key: "pool", label: "Новые задачи" },
    { key: "in_progress", label: "В работе" },
    { key: "review", label: "На проверке" },
    { key: "done", label: "Выполненные" },
  ]

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-heading text-h2">Мои задачи</h1>
        <p className="text-muted-foreground text-sm mt-1">{tasks.length} задач</p>
      </div>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader><DialogTitle>{selectedTask?.title}</DialogTitle></DialogHeader>
          {selectedTask && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">{selectedTask.description || "Нет описания"}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={statusMeta[selectedTask.status]?.variant || "secondary"}>{STATUS_LABELS[selectedTask.status]}</Badge>
                <span className="text-sm text-muted-foreground">{selectedTask.room}</span>
              </div>
              {selectedTask.deadline && (
                <p className="text-sm flex items-center gap-1 text-muted-foreground">
                  <Calendar className="h-4 w-4" /> Срок: {selectedTask.deadline.replace("T", " ").slice(0, 16)}
                </p>
              )}

              {images.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Фото отчёта ({images.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {images.map((img) => (
                      <div key={img.id} className="relative group">
                        <button type="button" onClick={() => setPreviewImage(img.url)} className="w-20 h-20 rounded-[10px] overflow-hidden border border-border hover:opacity-80 transition-opacity">
                          <img src={img.url} alt={img.original_name} className="w-full h-full object-cover" />
                        </button>
                        {selectedTask?.status === "in_progress" && (
                          <button type="button" onClick={() => handleDeleteImage(img)} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedTask.status === "pool" && (
                <Button className="w-full h-[48px] text-base" onClick={() => { handleStart(selectedTask.id); setDetailOpen(false) }}>
                  <Play className="h-5 w-5 mr-2" /> Приступить
                </Button>
              )}

              {selectedTask.status === "in_progress" && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Button className="flex-1 h-[46px]" onClick={() => handleComplete(selectedTask.id)}>
                      <CheckCircle className="h-4 w-4 mr-2" /> Выполнено
                    </Button>
                    <Button variant="secondary" className="flex-1 h-[46px]" onClick={() => setCancelOpen(true)}>
                      <XCircle className="h-4 w-4 mr-2" /> Не смог
                    </Button>
                  </div>
                  <div>
                    <input type="file" accept="image/*" id="image-upload" className="hidden" disabled={uploading || images.length >= 10} onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; setUploading(true); try { const img = await uploadTaskImage(selectedTask.id, file); setImages((prev) => [...prev, img]) } catch (err) { alert("Ошибка загрузки: " + (err instanceof Error ? err.message : "неизвестная ошибка")) } setUploading(false); e.target.value = "" }} />
                    <label htmlFor="image-upload" className={`flex items-center justify-center gap-2 h-[46px] rounded-[14px] border border-border text-sm cursor-pointer transition-all ${uploading || images.length >= 10 ? "opacity-50 cursor-not-allowed bg-black/5 dark:bg-white/5 text-muted-foreground" : "hover:bg-black/5 dark:hover:bg-white/5 text-foreground"}`}>
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                      {uploading ? "Загрузка..." : images.length >= 10 ? "Максимум 10 фото" : `Добавить фото (${images.length}/10)`}
                    </label>
                  </div>
                </div>
              )}

              {selectedTask.status === "review" && (
                <div className="flex items-center gap-2 p-3 rounded-[12px] bg-black/[0.03] dark:bg-white/[0.03] text-sm text-muted-foreground">
                  <ImageIcon className="h-4 w-4" />
                  Фото: {images.length} · ожидает проверки
                </div>
              )}

              {selectedTask.status === "done" && selectedTask.rating && (
                <p className={`text-sm font-medium ${selectedTask.rating < 0 ? 'text-red-400' : 'text-green-400'}`}>
                  Оценка: {selectedTask.rating > 0 ? `+${selectedTask.rating}` : selectedTask.rating}
                </p>
              )}

              {selectedTask.review_comment && (
                <div className="bg-red-500/5 border border-red-500/10 p-3 rounded-[12px] text-sm">
                  <p className="font-medium text-red-400">Комментарий:</p>
                  <p className="text-red-300/70 mt-1">{selectedTask.review_comment}</p>
                </div>
              )}
            </div>
          )}

          <Dialog open={!!previewImage} onOpenChange={(o) => !o && setPreviewImage(null)}>
            <DialogContent className="w-[95vw] max-w-2xl">
              <DialogHeader><DialogTitle>Фото</DialogTitle></DialogHeader>
              {previewImage && <img src={previewImage} alt="Фото" className="w-full h-auto rounded-[14px]" />}
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader><DialogTitle>Причина невыполнения</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input value={cancelComment} onChange={(e) => setCancelComment(e.target.value)} placeholder="Опишите причину..." />
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={() => setCancelOpen(false)}>Назад</Button>
              <Button className="flex-1" onClick={() => selectedTask && handleCancel(selectedTask.id)}>Отправить</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {sections.map(({ key, label }) => {
        const items = grouped[key]
        if (items.length === 0 && key !== "pool") return null
        return (
          <section key={key}>
            <h2 className="font-heading text-section-title mb-4 flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${statusMeta[key]?.dot || "bg-muted-foreground"}`} />
              {label}
              <span className="font-mono text-sm text-muted-foreground ml-1">{items.length}</span>
            </h2>
            <div className="space-y-2">
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Нет задач</p>
              ) : items.map((task) => (
                <Card key={task.id} className="cursor-pointer hover:-translate-y-0.5 transition-all duration-200 border-l-[3px]" style={{ borderLeftColor: key === "pool" ? "#8B5CF6" : key === "in_progress" ? "#F59E0B" : key === "review" ? "#4F7CFF" : "transparent" }} onClick={() => openDetail(task)}>
                  <CardContent className="py-4 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground break-words">{task.title}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>{task.room}</span>
                        {task.deadline && (
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {task.deadline.replace("T", " ").slice(0, 16)}</span>
                        )}
                      </div>
                    </div>
                    <Badge variant={statusMeta[task.status]?.variant || "secondary"} className="shrink-0">{STATUS_LABELS[task.status]}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
