import { WorkspaceDrawer, type WorkspaceDrawerProps } from '../WorkspaceDrawer/WorkspaceDrawer'
import './LoadoutWorkspaceDrawer.css'

export function LoadoutWorkspaceDrawer(props: WorkspaceDrawerProps) { return <WorkspaceDrawer {...props} className={`loadout-workspace-drawer ${props.className ?? ''}`.trim()} /> }
