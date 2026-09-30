import { Component, type ReactNode } from "react"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-background">
          <div className="text-center space-y-4 p-8">
            <div className="w-16 h-16 rounded-[16px] bg-red-500/10 flex items-center justify-center mx-auto">
              <span className="text-2xl">!</span>
            </div>
            <h2 className="text-lg font-medium text-foreground">Что-то пошло не так</h2>
            <p className="text-sm text-muted-foreground">Попробуйте обновить страницу</p>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.href = "/" }}
              className="px-4 py-2 rounded-[10px] bg-foreground/10 text-foreground text-sm hover:bg-foreground/20 transition-colors"
            >
              На главную
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
