import { WorkspaceLayout } from '../../features/workspace/WorkspaceLayout'

export default function WorkspacePage({ embedded = false }: { embedded?: boolean }) {
  return <WorkspaceLayout embedded={embedded} />
}
