import type { Assignee } from '../types/workspace';

interface JiraUser extends Assignee {
    active?: boolean;
    accountType?: string;
    avatarUrls?: Record<string, string>;
}

const previewUsers: Assignee[] = [
    { accountId: 'preview-alex', displayName: 'Alex Morgan' },
    { accountId: 'preview-sam', displayName: 'Sam Taylor' },
    { accountId: 'preview-robin', displayName: 'Robin Chen' }
];

const avatarHosts = [
    'avatar-management--avatars.us-west-2.prod.public.atl-paas.net',
    'avatar-management--avatars.us-east-1.prod.public.atl-paas.net',
    'avatar-management--avatars.eu-central-1.prod.public.atl-paas.net',
    'avatar-cdn.atlassian.com'
];

const avatarRequests = new Map<string, Promise<string | null>>();

function isApprovedAvatarHost(hostname: string): boolean {
    return (
        avatarHosts.includes(hostname) ||
        /^avatar-management--avatars\.[a-z0-9-]+\.prod\.public\.atl-paas\.net$/.test(hostname) ||
        hostname.endsWith('.atlassian.net')
    );
}

export function getUserAvatar(
    user: Partial<Assignee> & { avatarUrls?: Record<string, string> }
): string | null {
    const value = user.avatarUrls?.['48x48'] || user.avatarUrls?.['24x24'] || user.avatarUrl;
    if (!value) return null;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' &&
            !url.username &&
            !url.password &&
            isApprovedAvatarHost(url.hostname)
            ? url.href
            : null;
    } catch {
        return null;
    }
}

export async function loadAvatar(user: Assignee, refresh = false): Promise<string | null> {
    if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
        const provided = getUserAvatar(user);
        if (provided) return provided;
        if (!user.accountId.startsWith('preview-')) return null;
        const initials = user.displayName
            .split(/\s+/)
            .map((part) => part[0])
            .slice(0, 2)
            .join('');
        return `https://${avatarHosts[0]}/initials/${encodeURIComponent(initials)}-5.png`;
    }
    return loadJiraAvatar(user, refresh);
}

export async function loadJiraAvatar(user: Assignee, refresh = false): Promise<string | null> {
    const provided = getUserAvatar(user);
    if (refresh) avatarRequests.delete(user.accountId);
    if (!avatarRequests.has(user.accountId)) {
        avatarRequests.set(
            user.accountId,
            (async () => {
                const { requestJira } = await import('@forge/bridge');
                const response = await requestJira(
                    `/rest/api/3/user?accountId=${encodeURIComponent(user.accountId)}`
                );
                return response.ok ? getUserAvatar(await response.json()) || provided : provided;
            })().catch(() => provided)
        );
    }
    return avatarRequests.get(user.accountId)!;
}

export async function searchUsers(query: string): Promise<Assignee[]> {
    if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
        return previewUsers.filter((user) =>
            user.displayName.toLowerCase().includes(query.toLowerCase())
        );
    }
    const { requestJira } = await import('@forge/bridge');
    const response = await requestJira(
        `/rest/api/3/user/search?query=${encodeURIComponent(query)}&maxResults=20`
    );
    if (!response.ok) throw new Error('User search failed.');
    const users: JiraUser[] = await response.json();
    return users
        .filter((user) => user.active && user.accountType !== 'app')
        .map((user) => {
            const avatarUrl = getUserAvatar(user);
            return {
                accountId: user.accountId,
                displayName: user.displayName,
                ...(avatarUrl ? { avatarUrl } : {})
            };
        });
}
