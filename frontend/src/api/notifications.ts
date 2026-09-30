import { get, patch } from "./client"

export interface Notification {
  id: number
  user_id: number
  task_id: number | null
  type: "deadline_soon" | "overdue" | "review_ready" | "task_assigned" | "status_changed"
  message: string
  is_read: boolean
  created_at: string
}

export async function getNotifications(unreadOnly = false): Promise<Notification[]> {
  return get(`/notifications/?unread_only=${unreadOnly}`)
}

export async function markRead(id: number): Promise<Notification> {
  return patch(`/notifications/${id}/read`)
}
