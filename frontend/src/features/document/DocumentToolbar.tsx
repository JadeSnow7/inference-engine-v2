import { Bold, ChevronDown, Image, Italic, Link, List, Redo2, Table2, Undo2 } from 'lucide-react'
import type { ReactNode } from 'react'

export function DocumentToolbar() {
  return (
    <div className="flex h-12 items-center gap-2 border-b border-scholar-border bg-white px-4 text-scholar-text-secondary">
      <ToolButton label="撤销" icon={<Undo2 size={16} />} />
      <ToolButton label="重做" icon={<Redo2 size={16} />} />
      <div className="mx-1 h-5 w-px bg-scholar-border" />
      <button className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition hover:bg-scholar-bg-canvas">
        正文
        <ChevronDown size={14} />
      </button>
      <ToolButton label="加粗" icon={<Bold size={16} />} />
      <ToolButton label="斜体" icon={<Italic size={16} />} />
      <ToolButton label="列表" icon={<List size={16} />} />
      <ToolButton label="链接" icon={<Link size={16} />} />
      <ToolButton label="表格" icon={<Table2 size={16} />} />
      <ToolButton label="图片" icon={<Image size={16} />} />
      <button className="ml-auto rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-semibold text-scholar-primary transition hover:bg-blue-100">
        引用
      </button>
    </div>
  )
}

function ToolButton({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <button className="rounded-lg p-1.5 transition hover:bg-scholar-bg-canvas hover:text-scholar-primary" aria-label={label}>
      {icon}
    </button>
  )
}
