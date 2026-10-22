import type { Assignee, Graph, WorkspaceEntry } from '../../shared/workspace';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function validateGraph(payload: unknown): Graph {
    if (!isRecord(payload) || !Array.isArray(payload.items) || payload.items.length > 100) {
        throw new Error('A workspace can contain up to 100 items.');
    }

    const items = payload.items.map((item: unknown): WorkspaceEntry => {
        if (
            !isRecord(item) ||
            typeof item.id !== 'string' ||
            !/^[a-zA-Z0-9-]{1,80}$/.test(item.id)
        ) {
            throw new Error('Every item needs a valid ID.');
        }
        if (typeof item.name !== 'string' || !item.name.trim() || item.name.trim().length > 80) {
            throw new Error('Item names must contain between 1 and 80 characters.');
        }
        if (typeof item.description !== 'string' || item.description.length > 500) {
            throw new Error('Descriptions must contain at most 500 characters.');
        }
        if (
            !Array.isArray(item.childIds) ||
            item.childIds.some((childId) => typeof childId !== 'string')
        ) {
            throw new Error('Connections must reference item IDs.');
        }
        if (new Set(item.childIds).size !== item.childIds.length) {
            throw new Error('An item cannot have duplicate connections.');
        }
        const type = item.type;
        if (type !== 'group' && type !== 'goal' && type !== 'metric') {
            throw new Error('Entries must be groups, goals, or metrics.');
        }
        const assignees = item.assignees ?? [];
        if (!Array.isArray(assignees) || assignees.length > 20) {
            throw new Error('Goals and metrics support up to 20 assignees.');
        }
        if (type === 'group' && assignees.length) {
            throw new Error('Assign users to goals and metrics, not groups.');
        }
        const normalizedAssignees = assignees.map((assignee: unknown): Assignee => {
            if (
                !isRecord(assignee) ||
                typeof assignee.accountId !== 'string' ||
                !assignee.accountId.trim() ||
                assignee.accountId.length > 128 ||
                typeof assignee.displayName !== 'string' ||
                !assignee.displayName.trim() ||
                assignee.displayName.length > 200
            ) {
                throw new Error('Every assignee needs a Jira account ID and display name.');
            }
            let avatarUrl;
            if (assignee.avatarUrl) {
                try {
                    if (typeof assignee.avatarUrl !== 'string')
                        throw new Error('Invalid avatar URL.');
                    const url = new URL(assignee.avatarUrl);
                    const hosts = [
                        'avatar-management--avatars.us-west-2.prod.public.atl-paas.net',
                        'avatar-management--avatars.us-east-1.prod.public.atl-paas.net',
                        'avatar-management--avatars.eu-central-1.prod.public.atl-paas.net',
                        'avatar-cdn.atlassian.com'
                    ];
                    if (
                        typeof assignee.avatarUrl !== 'string' ||
                        assignee.avatarUrl.length > 2048 ||
                        url.protocol !== 'https:' ||
                        url.username ||
                        url.password ||
                        (!hosts.includes(url.hostname) && !url.hostname.endsWith('.atlassian.net'))
                    )
                        throw new Error('Invalid avatar host.');
                    avatarUrl = url.href;
                } catch {
                    throw new Error('Avatar images must use an approved Atlassian HTTPS host.');
                }
            }
            return {
                accountId: assignee.accountId.trim(),
                displayName: assignee.displayName.trim(),
                ...(avatarUrl ? { avatarUrl } : {})
            };
        });
        if (
            new Set(normalizedAssignees.map((assignee) => assignee.accountId)).size !==
            normalizedAssignees.length
        ) {
            throw new Error('Assignees must be unique.');
        }
        const metric: Pick<WorkspaceEntry, 'currentValue' | 'targetValue' | 'unit'> = {};
        if (type === 'metric') {
            for (const field of ['currentValue', 'targetValue'] as const) {
                const value = item[field] ?? null;
                if (value !== null && (typeof value !== 'number' || !Number.isFinite(value))) {
                    throw new Error('Metric values must be finite numbers or empty.');
                }
                metric[field] = value;
            }
            if (
                item.unit !== undefined &&
                (typeof item.unit !== 'string' || item.unit.length > 40)
            ) {
                throw new Error('Metric units must contain at most 40 characters.');
            }
            metric.unit = (item.unit ?? '').trim();
        }
        return {
            id: item.id,
            type,
            name: item.name.trim(),
            description: item.description.trim(),
            childIds: [...item.childIds],
            assignees: normalizedAssignees,
            ...metric
        };
    });

    const byId = new Map(items.map((item) => [item.id, item]));
    if (byId.size !== items.length) {
        throw new Error('Item IDs must be unique.');
    }
    if (items.reduce((total, item) => total + item.childIds.length, 0) > 300) {
        throw new Error('A workspace can contain up to 300 connections.');
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();
    function visit(item: WorkspaceEntry): void {
        if (visiting.has(item.id)) {
            throw new Error('This connection would create a cycle.');
        }
        if (visited.has(item.id)) return;
        visiting.add(item.id);
        item.childIds.forEach((childId) => {
            const child = byId.get(childId);
            if (!child) throw new Error('A connection references an item that no longer exists.');
            if (
                item.type === 'metric' ||
                (item.type === 'group' && child.type === 'metric') ||
                (item.type === 'goal' && child.type === 'group')
            ) {
                throw new Error(
                    'Groups contain groups or goals; goals contain goals or metrics; metrics have no children.'
                );
            }
            visit(child);
        });
        visiting.delete(item.id);
        visited.add(item.id);
    }
    items.forEach(visit);
    if (Buffer.byteLength(JSON.stringify({ items }), 'utf8') > 200 * 1024) {
        throw new Error('The workspace exceeds the 200 KB storage limit.');
    }
    return { items };
}
