import type { DocumentBlock } from '../../types/workspace'

export type VersionBlockDiffKind = 'current-only' | 'snapshot-only' | 'modified' | 'unchanged'

export interface VersionBlockDiff {
  id: string
  kind: VersionBlockDiffKind
  label: string
  block: DocumentBlock
  currentBlock?: DocumentBlock
  snapshotBlock?: DocumentBlock
}

const diffLabelByKind: Record<Exclude<VersionBlockDiffKind, 'unchanged'>, string> = {
  'current-only': '当前新增',
  'snapshot-only': '历史存在',
  modified: '内容变化',
}

export function buildVersionBlockDiff(currentBlocks: DocumentBlock[], snapshotBlocks: DocumentBlock[]): VersionBlockDiff[] {
  const currentById = new Map(currentBlocks.map(block => [block.id, block]))
  const snapshotById = new Map(snapshotBlocks.map(block => [block.id, block]))
  const orderedIds = [
    ...snapshotBlocks.map(block => block.id),
    ...currentBlocks.map(block => block.id).filter(id => !snapshotById.has(id)),
  ]

  return orderedIds.map((id): VersionBlockDiff => {
    const currentBlock = currentById.get(id)
    const snapshotBlock = snapshotById.get(id)

    if (currentBlock && !snapshotBlock) {
      return {
        id,
        kind: 'current-only',
        label: diffLabelByKind['current-only'],
        block: currentBlock,
        currentBlock,
      }
    }

    if (!currentBlock && snapshotBlock) {
      return {
        id,
        kind: 'snapshot-only',
        label: diffLabelByKind['snapshot-only'],
        block: snapshotBlock,
        snapshotBlock,
      }
    }

    if (currentBlock && snapshotBlock && blockChanged(currentBlock, snapshotBlock)) {
      return {
        id,
        kind: 'modified',
        label: diffLabelByKind.modified,
        block: snapshotBlock,
        currentBlock,
        snapshotBlock,
      }
    }

    const block = snapshotBlock ?? currentBlock
    return {
      id,
      kind: 'unchanged',
      label: '未变化',
      block: block as DocumentBlock,
      currentBlock,
      snapshotBlock,
    }
  })
}

export function changedVersionBlocks(currentBlocks: DocumentBlock[], snapshotBlocks: DocumentBlock[]): VersionBlockDiff[] {
  return buildVersionBlockDiff(currentBlocks, snapshotBlocks).filter(diff => diff.kind !== 'unchanged')
}

function blockChanged(currentBlock: DocumentBlock, snapshotBlock: DocumentBlock): boolean {
  return (
    currentBlock.content !== snapshotBlock.content
    || currentBlock.title !== snapshotBlock.title
    || currentBlock.type !== snapshotBlock.type
  )
}
