import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/contexts/AuthContext"
import { Eye, EyeOff } from "lucide-react"

export function LoginPage() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const { login } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    try {
      await login({ username, password })
      navigate("/")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="fixed inset-0 pointer-events-none bg-glow-purple" />
      <div className="fixed inset-0 pointer-events-none bg-glow-pink" />
      <div className="fixed inset-0 pointer-events-none bg-glow-blue" />
      <Card className="w-full max-w-md mx-4 relative animate-slide-up">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 rounded-[20px] bg-background flex items-center justify-center shadow-glow p-1.5">
              <img src="/logo.png" alt="TextureTasks" className="w-full h-full object-contain" />
            </div>
          </div>
          <CardTitle className="text-h2">TextureTasks</CardTitle>
          <CardDescription className="text-base">Управление задачами автосервиса</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-[12px]">
                <span>{error}</span>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Логин</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Введите логин"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Пароль</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Введите пароль"
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-2.5 rounded-[8px] transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full h-[48px] text-base">
              Войти
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
