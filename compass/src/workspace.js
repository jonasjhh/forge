export function workspaceKey(context) {
    if (!context?.accountId) throw new Error('Sign in to Jira to open the shared workspace.');
    return 'compass:workspace:shared';
}
