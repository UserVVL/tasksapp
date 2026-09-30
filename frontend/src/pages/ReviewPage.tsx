import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/contexts/AuthContext"
import { getTasks, reviewTask, getTaskImages, STATUS_LABELS, type Task, type TaskImage } from "@/api/tasks"
import { CheckCircle, XCircle, Calendar, Star, User as UserIcon, AlertTriangle } from "lucide-react"

export function ReviewPage() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [rating, setRating] = useState(5)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [taskImages, setTaskImages] = useState<TaskImage[]>([])
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  useEffect(() => { getTasks({ status: "review" }).then(setTasks).catch(() => {}) }, [])
  async function load() { getTasks({ status: "review" }).then(setTasks) }

  async function openReview(task: Task) {
    setSelectedTask(task); setRating(5); setReviewOpen(true)
    try { setTaskImages(await getTaskImages(task.id)) } catch { setTaskImages([]) }
  }

  async function handleReview() {
    if (!selectedTask) return
    try {
      await reviewTask(selectedTask.id, rating)
      setReviewOpen(false); setSelectedTask(null); load()
    } catch (err) { alert("Ошибка: " + (err instanceof Error ? err.message : "неизвестная ошибка")) }
  }

  const isManager = user?.role === "director" || user?.role === "manager"
  if (!isManager) return <div className="text-center py-12 text-muted-foreground">Доступно только руководителю и управляющему</div>

  const completed = tasks.filter((t) => !t.review_comment)
  const cancelled = tasks.filter((t) => t.review_comment)

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="font-heading text-h2">Проверка задач</h1>
        <p className="text-muted-foreground text-sm mt-1">{tasks.length} задач на проверке</p>
      </div>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedTask?.review_comment ? "Подтверждение отмены" : "Оценить задачу"}</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-5">
              <p className="font-heading text-h3 text-foreground">{selectedTask.title}</p>
              {selectedTask.description && <p className="text-sm text-muted-foreground">{selectedTask.description}</p>}
              <div className="flex items-center gap-3 flex-wrap text-sm text-muted-foreground">
                <span>{selectedTask.room}</span>
                {selectedTask.deadline && (
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {selectedTask.deadline.replace("T", " ").slice(0, 16)}</span>
                )}
                <span className="flex items-center gap-1">
                  <UserIcon className="h-3 w-3" /> {selectedTask.assignees.map((a) => a.full_name).join(", ")}
                </span>
              </div>

              {taskImages.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Фото отчёта ({taskImages.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {taskImages.map((img) => (
                      <button key={img.id} type="button" onClick={() => setPreviewImage(img.url)} className="w-20 h-20 rounded-[10px] overflow-hidden border border-border hover:opacity-80 transition-opacity">
                        <img src={img.url} alt={img.original_name} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedTask.review_comment ? (
                <>
                  <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-[14px] text-sm">
                    <p className="font-medium text-red-400 flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Причина невыполнения:</p>
                    <p className="text-red-300/70 mt-1">{selectedTask.review_comment}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">Paint coins за эту задачу начисляться не будут.</p>
                  <Button className="w-full h-[46px]" variant="destructive" onClick={handleReview}>
                    <XCircle className="h-4 w-4 mr-2" /> Подтвердить отмену
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-foreground">Оценка выполнения (−5...−1 / 1...5)</label>
                    <div className="flex items-center justify-center gap-px sm:gap-1 w-full">
                      {[-5, -4, -3, -2, -1, 1, 2, 3, 4, 5].map((n) => (
                        <button key={n} type="button" onClick={() => setRating(n)}
                          className={`flex-1 min-w-0 max-w-[38px] sm:max-w-[42px] h-7 sm:h-8 rounded-[5px] sm:rounded-[8px] flex items-center justify-center text-[10px] sm:text-xs font-bold border transition-all duration-200 ${
                            rating === n
                              ? n < 0
                                ? "bg-red-500 text-white border-red-400 shadow-lg"
                                : "bg-yellow-500 text-yellow-950 border-yellow-400 shadow-lg"
                              : n < 0
                                ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                                : "bg-black/5 dark:bg-white/5 text-muted-foreground border-border hover:bg-black/10 dark:hover:bg-white/10 hover:text-foreground"
                          }`}
                        >
                          {n > 0 ? `+${n}` : n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="pt-1">
                    <Button className="w-full h-[46px]" onClick={handleReview}>
                      <CheckCircle className="h-4 w-4 mr-2" /> Подтвердить
                    </Button>
                  </div>
                </>
              )}
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

      {tasks.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">Нет задач на проверку</CardContent>
        </Card>
      )}

      {completed.length > 0 && (
        <section>
          <h2 className="font-heading text-section-title mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-400" /> Выполненные задачи
          </h2>
          <div className="space-y-3">
            {completed.map((task) => (
              <Card key={task.id} className="group hover:-translate-y-0.5 transition-all duration-200">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base">{task.title}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">{task.room}</p>
                    </div>
                    <Badge variant="warning">{STATUS_LABELS[task.status]}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {task.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{task.description}</p>}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" /> {task.assignees.map((a) => a.full_name).join(", ")}</span>
                      {task.deadline && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {task.deadline.replace("T", " ").slice(0, 16)}</span>}
                    </div>
                    <Button onClick={() => openReview(task)}>
                      <Star className="h-4 w-4 mr-1" /> Оценить
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {cancelled.length > 0 && (
        <section>
          <h2 className="font-heading text-section-title mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-400" /> Невыполненные задачи
          </h2>
          <div className="space-y-3">
            {cancelled.map((task) => (
              <Card key={task.id} className="group hover:-translate-y-0.5 transition-all duration-200 border-red-500/10">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-base">{task.title}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">{task.room}</p>
                    </div>
                    <Badge variant="destructive">{STATUS_LABELS[task.status]}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {task.description && <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{task.description}</p>}
                  {task.review_comment && <p className="text-sm text-red-400 mb-3 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> {task.review_comment}</p>}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" /> {task.assignees.map((a) => a.full_name).join(", ")}</span>
                      {task.deadline && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {task.deadline.replace("T", " ").slice(0, 16)}</span>}
                    </div>
                    <Button variant="destructive" onClick={() => openReview(task)}>
                      <XCircle className="h-4 w-4 mr-1" /> Подтвердить отмену
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
