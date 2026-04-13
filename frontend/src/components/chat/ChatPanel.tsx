import { useChatStore } from '../../store/chat'
import { useAutoScroll } from '../../hooks/useAutoScroll'
import { MessageBubble } from './MessageBubble'
import { StreamingBubble } from './StreamingBubble'
import { EmptyState } from './EmptyState'

export function ChatPanel() {
  const messages = useChatStore((s) => s.messages)
  const scrollRef = useAutoScroll(messages)

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-4 py-6 space-y-4"
    >
      {messages.length === 0 && <EmptyState />}
      {messages.map((msg) =>
        msg.isStreaming
          ? <StreamingBubble key={msg.id} message={msg} />
          : <MessageBubble key={msg.id} message={msg} />
      )}
    </div>
  )
}
