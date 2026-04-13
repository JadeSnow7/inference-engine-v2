import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Message } from '../../types/events'

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => { /* ignore */ })
}

export function MessageBubble({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[70%] bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="max-w-[85%] bg-white border rounded-2xl rounded-tl-sm px-4 py-3 text-sm">
        <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
      <div className="flex gap-2 pl-2">
        <button
          onClick={() => copyToClipboard(message.content)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          复制
        </button>
      </div>
    </div>
  )
}
