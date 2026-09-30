import { get, post } from "./client"

export interface Token {
  access_token: string
  token_type: string
}

export interface User {
  id: number
  username: string
  full_name: string
  role: "director" | "manager" | "admin" | "painter"
  is_active: boolean
  score: number
  created_at: string
}

export interface LoginData {
  username: string
  password: string
}

export interface RegisterData extends LoginData {
  full_name: string
  role: "director" | "manager" | "admin" | "painter"
}

export async function login(data: LoginData): Promise<Token> {
  return post("/auth/login", data)
}

export async function register(data: RegisterData): Promise<User> {
  return post("/auth/register", data)
}

export async function getMe(): Promise<User> {
  return get("/auth/me")
}
