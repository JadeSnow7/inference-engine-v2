import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Message } from '../../types/events'

// Constraint J: React.memo prevents unnecessary re-renders during streaming
export const StreamingBubble = memo(function StreamingBubble({ message }: { message: Message }) {
  return (
    <div className="flex flex-col">
      <div className="max-w-[85%] bg-white border rounded-2xl rounded-tl-sm px-4 py-3 text-sm">
        <div className="prose prose-sm max-w-none prose-p:my-1 prose-headings:my-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>
        {/* Blinking cursor */}
        <span className="inline-block w-0.5 h-4 bg-gray-600 animate-pulse ml-0.5 align-middle" />
      </div>
    </div>
  )
})
