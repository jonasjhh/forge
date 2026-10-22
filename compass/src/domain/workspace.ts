import type { WorkspaceContext } from '../../shared/workspace';

export function workspaceKey(context: WorkspaceContext | undefined): string {
    if (!context?.accountId) throw new Error('Sign in to Jira to open the shared workspace.');
    return 'compass:workspace:shared';
}
