import { get, post, del } from "./client"
import type { Task } from "./tasks"

export interface WeeklyList {
  id: number
  title: string
  week_start: string
  week_end: string
  created_by: number
  created_at: string
  tasks: Task[]
}

export interface CreateWeeklyListData {
  title: string
  week_start: string
  week_end: string
}

export async function getWeeklyLists(): Promise<WeeklyList[]> {
  return get("/weekly-lists/")
}

export async function getWeeklyList(id: number): Promise<WeeklyList> {
  return get(`/weekly-lists/${id}`)
}

export async function createWeeklyList(data: CreateWeeklyListData): Promise<WeeklyList> {
  return post("/weekly-lists/", data)
}

export async function deleteWeeklyList(id: number): Promise<void> {
  return del(`/weekly-lists/${id}`)
}
