import { AISuggestionPanel } from '../ai/AISuggestionPanel'
import { AIChatInput } from '../ai/AIChatInput'
import { DocumentEditor } from '../document/DocumentEditor'

export function MainWorkspace() {
  return (
    <main className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="min-h-0 flex-[1.35] overflow-hidden">
        <DocumentEditor />
      </div>
      <section className="flex min-h-[360px] flex-[0.95] flex-col overflow-hidden rounded-2xl border border-scholar-border bg-white shadow-sm">
        <AISuggestionPanel />
        <AIChatInput />
      </section>
    </main>
  )
}
