import { get, post, patch, del, del as apiDel, BASE_URL } from "./client"
import type { User } from "./auth"

export type TaskStatus = "pool" | "in_progress" | "review" | "done" | "overdue" | "cancelled"

export interface Task {
  id: number
  weekly_list_id: number
  created_by: number
  title: string
  description: string
  room: string
  status: TaskStatus
  rating: number | null
  review_comment: string | null
  completed_at: string | null
  deadline: string | null
  created_at: string
  updated_at: string
  assignees: User[]
}

export interface CreateTaskData {
  title: string
  description?: string
  room?: string
  deadline: string
  assignee_ids?: number[]
}

export interface UpdateTaskData {
  title?: string
  description?: string
  room?: string
  status?: TaskStatus
  assignee_ids?: number[]
  deadline?: string | null
  review_comment?: string | null
  rating?: number | null
}

export async function getTasks(params?: {
  weekly_list_id?: number
  assignee_id?: number
  status?: TaskStatus
}): Promise<Task[]> {
  const query = new URLSearchParams()
  if (params?.weekly_list_id) query.set("weekly_list_id", String(params.weekly_list_id))
  if (params?.assignee_id) query.set("assignee_id", String(params.assignee_id))
  if (params?.status) query.set("status", params.status)
  const qs = query.toString()
  return get(`/tasks/${qs ? `?${qs}` : ""}`)
}

export async function createTask(weeklyListId: number, data: CreateTaskData): Promise<Task> {
  return post(`/tasks/?weekly_list_id=${weeklyListId}`, data)
}

export async function getTask(id: number): Promise<Task> {
  return get(`/tasks/${id}`)
}

export async function updateTask(id: number, data: UpdateTaskData): Promise<Task> {
  return patch(`/tasks/${id}`, data)
}

export async function deleteTask(id: number): Promise<void> {
  return del(`/tasks/${id}`)
}

export async function startTask(id: number): Promise<Task> {
  return post(`/tasks/${id}/start`)
}

export async function completeTask(id: number): Promise<Task> {
  return post(`/tasks/${id}/complete`)
}

export async function cancelTask(id: number, comment = ""): Promise<Task> {
  return post(`/tasks/${id}/cancel`, { comment })
}

export async function reviewTask(id: number, rating: number): Promise<Task> {
  return post(`/tasks/${id}/review`, { rating })
}

export async function getArchive(): Promise<Task[]> {
  return get("/tasks/archive")
}

export interface TaskImage {
  id: number
  filename: string
  original_name: string
  uploaded_at: string
  uploaded_by: number
  url: string
}

function fixUrl(img: TaskImage): TaskImage {
  const token = localStorage.getItem("token")
  const sep = img.url.includes("?") ? "&" : "?"
  return { ...img, url: `${BASE_URL}${img.url}${token ? `${sep}token=${encodeURIComponent(token)}` : ""}` }
}

export async function getTaskImages(taskId: number): Promise<TaskImage[]> {
  const imgs = await get<TaskImage[]>(`/tasks/${taskId}/images`)
  return imgs.map(fixUrl)
}

export async function uploadTaskImage(taskId: number, file: File): Promise<TaskImage> {
  const formData = new FormData()
  formData.append("file", file)
  const token = localStorage.getItem("token")
  const res = await fetch(`${BASE_URL}/tasks/${taskId}/images`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }))
    throw new Error(err.detail || "Upload failed")
  }
  return fixUrl(await res.json())
}

export async function deleteTaskImage(taskId: number, imageId: number): Promise<void> {
  return apiDel(`/tasks/${taskId}/images/${imageId}`)
}

export const ROOMS = [
  "Зона приемки",
  "Санузел",
  "Техническое помещение",
  "Ремонтный цех",
  "Улица",
  "Комната отдыха",
  "Склад",
  "Мокрый цех",
  "Прочие задачи",
] as const

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pool: "В пуле",
  in_progress: "В работе",
  review: "На проверке",
  done: "Выполнено",
  overdue: "Просрочено",
  cancelled: "Отменено",
}

export const STATUS_COLORS: Record<TaskStatus, string> = {
  pool: "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-orange-100 text-orange-800 border-orange-200",
  review: "bg-purple-100 text-purple-800 border-purple-200",
  done: "bg-green-100 text-green-800 border-green-200",
  overdue: "bg-red-100 text-red-800 border-red-200",
  cancelled: "bg-gray-100 text-gray-800 border-gray-200",
}
