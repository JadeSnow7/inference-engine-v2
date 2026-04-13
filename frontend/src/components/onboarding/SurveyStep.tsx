interface Option {
  label: string
  description: string
  value: string
}

interface SurveyStepProps {
  question: string
  options: Option[]
  selected: string | null
  onSelect: (value: string) => void
}

export function SurveyStep({ question, options, selected, onSelect }: SurveyStepProps) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-800 mb-3">{question}</p>
      <div className="space-y-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
              selected === opt.value
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300 text-gray-700'
            }`}
          >
            <span className="font-medium">{opt.label}</span>
            {opt.description && (
              <span className="text-gray-500"> — {opt.description}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
