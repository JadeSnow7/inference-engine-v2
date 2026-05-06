export function ReasoningPanel({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-2">
      {steps.map((step, index) => (
        <li key={step} className="flex gap-3 rounded-xl bg-scholar-bg-canvas px-3 py-2 text-sm text-scholar-text-secondary">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-scholar-primary">
            {index + 1}
          </span>
          <span className="leading-6">{step}</span>
        </li>
      ))}
    </ol>
  )
}
