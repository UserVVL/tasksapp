export const BASE_URL = "/api"

const TIMEOUT_MS = 25000

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token")
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers, signal: controller.signal })
  } catch {
    clearTimeout(timeoutId)
    throw new Error("Нет соединения с сервером. Проверьте интернет.")
  }
  clearTimeout(timeoutId)
  if (res.status === 401 && path !== "/auth/login") {
    localStorage.removeItem("token")
    window.location.replace("/")
    return undefined as T
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Ошибка сервера" }))
    if (Array.isArray(err.detail)) {
      throw new Error(err.detail.map((e: { msg?: string }) => e.msg || "Ошибка валидации").join("; "))
    }
    throw new Error(typeof err.detail === "string" ? err.detail : "Ошибка сервера")
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export function get<T>(path: string) {
  return request<T>(path)
}

export function post<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  })
}

export function patch<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  })
}

export function del<T = void>(path: string) {
  return request<T>(path, { method: "DELETE" })
}
