import type { ReactNode } from 'react'
import { WorkspaceDrawer } from '../WorkspaceDrawer/WorkspaceDrawer'

export function CatalogWriteDrawer({ title, busy, children, footer, onClose }: { title: string; busy?: boolean; children: ReactNode; footer: ReactNode; onClose(): void }) {
  return <WorkspaceDrawer title={title} busy={busy} onClose={onClose} footer={footer}>{children}</WorkspaceDrawer>
}
