import React from 'react'

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean
  errorId: string | null
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    errorId: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    void error
    return { hasError: true, errorId: createErrorId() }
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen w-full items-center justify-center bg-scholar-bg-canvas px-4 text-scholar-text-primary">
          <div className="w-full max-w-md rounded-2xl border border-scholar-border bg-white p-6 text-center shadow-sm">
            <h1 className="text-xl font-bold">应用暂时无法显示</h1>
            <p className="mt-3 text-sm leading-6 text-scholar-text-secondary">
              页面遇到异常，请刷新后重试。我们已在控制台记录详细错误，页面不会展示调试堆栈。
            </p>
            {this.state.errorId && (
              <p className="mt-3 text-xs font-semibold text-scholar-text-weak">错误编号：{this.state.errorId}</p>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-xl bg-scholar-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-scholar-primary-hover"
            >
              刷新页面
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function createErrorId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID().slice(0, 8)
  }
  return Date.now().toString(36)
}
