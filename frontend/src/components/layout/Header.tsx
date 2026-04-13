import { useUserStore } from '../../store/user'
import { useChatStore } from '../../store/chat'
import { detectScene, SCENE_LABELS, SCENE_COLORS } from '../../utils/scene'

export function Header() {
  const userId = useUserStore((s) => s.userId)
  const logout = useUserStore((s) => s.logout)
  const messages = useChatStore((s) => s.messages)

  // Derive scene from the last user message
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
  const scene = lastUserMsg ? detectScene(lastUserMsg.content) : null

  return (
    <header className="h-12 shrink-0 flex items-center px-4 border-b bg-white gap-3">
      <span className="font-semibold text-gray-900 text-sm">学术写作助手</span>

      {scene && (
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SCENE_COLORS[scene]}`}>
          {SCENE_LABELS[scene]}
        </span>
      )}

      <div className="ml-auto flex items-center gap-3">
        {userId && (
          <span className="text-xs text-gray-500 truncate max-w-[160px]">{userId}</span>
        )}
        <button
          onClick={logout}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          退出
        </button>
      </div>
    </header>
  )
}
