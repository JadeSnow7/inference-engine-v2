import { AIChatInput } from '../ai/AIChatInput'
import { DocumentEditor } from '../document/DocumentEditor'

export function MainWorkspace() {
  return (
    <main className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="min-h-0 flex-1 overflow-hidden">
        <DocumentEditor />
      </div>
      <section className="shrink-0 rounded-2xl border border-scholar-border bg-white shadow-sm">
        <AIChatInput />
      </section>
    </main>
  )
}
