import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "@/contexts/AuthContext"
import { ThemeProvider } from "@/contexts/ThemeContext"
import { Layout } from "@/components/layout/Layout"
import { LoginPage } from "@/pages/LoginPage"
import { DashboardPage } from "@/pages/DashboardPage"
import { WeeklyListsPage } from "@/pages/WeeklyListsPage"
import { WeeklyListDetailPage } from "@/pages/WeeklyListDetailPage"
import { RoomDetailPage } from "@/pages/RoomDetailPage"
import { NotificationsPage } from "@/pages/NotificationsPage"
import { UsersPage } from "@/pages/UsersPage"
import { WorkerTasksPage } from "@/pages/WorkerTasksPage"
import { ReviewPage } from "@/pages/ReviewPage"
import { ArchivePage } from "@/pages/ArchivePage"
import { ErrorBoundary } from "@/components/ErrorBoundary"

function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/weekly-lists" element={<WeeklyListsPage />} />
            <Route path="/weekly-lists/:id" element={<WeeklyListDetailPage />} />
            <Route path="/weekly-lists/room/:roomName" element={<RoomDetailPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/my-tasks" element={<WorkerTasksPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/archive" element={<ArchivePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
