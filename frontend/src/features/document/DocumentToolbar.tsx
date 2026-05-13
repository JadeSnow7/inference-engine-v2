import { Bold, ChevronDown, Image, Italic, Link, List, Redo2, Save, Table2, Undo2 } from 'lucide-react'
import type { ReactNode } from 'react'
import type { InlineMarkdownCommand } from '../../store/workspace'
import type { DocumentBlockType, WorkspaceSaveStatus } from '../../types/workspace'

interface DocumentToolbarProps {
  currentBlockType: DocumentBlockType
  saveStatus: WorkspaceSaveStatus
  onSave: () => void
  onFormat: (command: InlineMarkdownCommand) => void
  onToggleBlockType: () => void
  onOpenReferences: () => void
}

export function DocumentToolbar({
  currentBlockType,
  saveStatus,
  onSave,
  onFormat,
  onToggleBlockType,
  onOpenReferences,
}: DocumentToolbarProps) {
  const isSaving = saveStatus === 'saving'

  return (
    <div className="flex h-12 items-center gap-2 border-b border-scholar-border bg-white px-4 text-scholar-text-secondary">
      <ToolButton label="保存" icon={<Save size={16} />} onClick={onSave} disabled={isSaving} />
      <ToolButton label="撤销" icon={<Undo2 size={16} />} disabled title="演示版暂未接入该编辑命令" />
      <ToolButton label="重做" icon={<Redo2 size={16} />} disabled title="演示版暂未接入该编辑命令" />
      <div className="mx-1 h-5 w-px bg-scholar-border" />
      <button
        type="button"
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition hover:bg-scholar-bg-canvas hover:text-scholar-primary"
        onClick={onToggleBlockType}
        title="在标题和正文之间切换当前 block"
      >
        {currentBlockType === 'heading' ? '标题' : '正文'}
        <ChevronDown size={14} />
      </button>
      <ToolButton label="加粗" icon={<Bold size={16} />} onClick={() => onFormat('bold')} />
      <ToolButton label="斜体" icon={<Italic size={16} />} onClick={() => onFormat('italic')} />
      <ToolButton label="列表" icon={<List size={16} />} onClick={() => onFormat('list')} />
      <ToolButton label="链接" icon={<Link size={16} />} onClick={() => onFormat('link')} />
      <ToolButton label="表格" icon={<Table2 size={16} />} disabled title="演示版暂未接入该编辑命令" />
      <ToolButton label="图片" icon={<Image size={16} />} disabled title="演示版暂未接入该编辑命令" />
      <button
        type="button"
        className="ml-auto rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-semibold text-scholar-primary transition hover:bg-blue-100"
        onClick={onOpenReferences}
      >
        引用
      </button>
    </div>
  )
}

function ToolButton({
  icon,
  label,
  onClick,
  disabled = false,
  title,
}: {
  icon: ReactNode
  label: string
  onClick?: () => void
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      className="rounded-lg p-1.5 transition hover:bg-scholar-bg-canvas hover:text-scholar-primary disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-inherit"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {icon}
    </button>
  )
}
