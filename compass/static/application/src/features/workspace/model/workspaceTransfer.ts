import { canContain, goalCategories, goalStatuses } from './entries';
import type { GoalStatus, Graph, WorkspaceEntry, WorkspaceLabel } from '../../../types/workspace';

function requireValid(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validText(value: unknown, maximum: number, required = false): value is string {
    return typeof value === 'string' && value.length <= maximum && (!required || !!value.trim());
}

function validId(value: unknown): value is string {
    return typeof value === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value);
}

function validIds(value: unknown, maximum: number): value is string[] {
    return (
        Array.isArray(value) &&
        value.length <= maximum &&
        value.every(validId) &&
        new Set(value).size === value.length
    );
}

function validateLabel(value: unknown): asserts value is WorkspaceLabel {
    requireValid(isRecord(value), 'Every label must be an object.');
    requireValid(
        validId(value.id) &&
            validText(value.name, 50, true) &&
            typeof value.color === 'string' &&
            /^#[0-9a-fA-F]{6}$/.test(value.color),
        'Labels need a valid ID, a name of up to 50 characters, and a hexadecimal color.'
    );
}

function validateEntry(value: unknown): asserts value is WorkspaceEntry {
    requireValid(isRecord(value), 'Every entry must be an object.');
    requireValid(
        validId(value.id) && validText(value.name, 200, true) && validText(value.description, 500),
        'Entries need a valid ID, name, and description.'
    );
    requireValid(
        value.type === 'group' || value.type === 'goal' || value.type === 'metric',
        'Entries must be groups, goals, or metrics.'
    );
    requireValid(
        validIds(value.childIds, 300) && validIds(value.labelIds, 20),
        'Entry connections and labels must contain unique IDs.'
    );
    requireValid(
        Array.isArray(value.assignees) && value.assignees.length <= 20,
        'Entries support up to 20 assignees.'
    );
    for (const assignee of value.assignees) {
        requireValid(
            isRecord(assignee) &&
                validText(assignee.accountId, 128, true) &&
                validText(assignee.displayName, 200, true),
            'Assignees need an account ID and display name.'
        );
        if (assignee.avatarUrl !== undefined) {
            requireValid(validText(assignee.avatarUrl, 2048), 'Avatar URLs must be strings.');
            let url: URL;
            try {
                url = new URL(assignee.avatarUrl);
            } catch {
                throw new Error('Invalid avatar URL.');
            }
            requireValid(
                url.protocol === 'https:' &&
                    !url.username &&
                    !url.password &&
                    (/^avatar-management--avatars\.[a-z0-9-]+\.prod\.public\.atl-paas\.net$/.test(
                        url.hostname
                    ) ||
                        url.hostname === 'avatar-cdn.atlassian.com' ||
                        url.hostname.endsWith('.atlassian.net')),
                'Avatar images must use an approved Atlassian HTTPS host.'
            );
        }
    }
    requireValid(
        new Set(value.assignees.map((assignee) => assignee.accountId.trim())).size ===
            value.assignees.length,
        'Assignees must be unique.'
    );
    requireValid(
        value.type !== 'group' || value.assignees.length === 0,
        'Groups cannot have assignees.'
    );
    if (value.type === 'goal') {
        requireValid(
            value.goalCategory === undefined ||
                goalCategories.some((category) => category === value.goalCategory),
            'Invalid goal category.'
        );
        requireValid(
            value.status === undefined ||
                (typeof value.status === 'string' &&
                    goalStatuses.includes(value.status as GoalStatus)),
            'Goals must use green, yellow, or red status.'
        );
        requireValid(
            value.targetDate === undefined ||
                (typeof value.targetDate === 'string' &&
                    /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value.targetDate)),
            'Goal target dates must use the YYYY-MM format.'
        );
    }
    if (value.type === 'metric') {
        for (const field of ['currentValue', 'targetValue'] as const) {
            requireValid(
                value[field] === undefined ||
                    value[field] === null ||
                    (typeof value[field] === 'number' && Number.isFinite(value[field])),
                'Metric values must be finite numbers or empty.'
            );
        }
        requireValid(
            value.unit === undefined || validText(value.unit, 40),
            'Metric units support up to 40 characters.'
        );
    }
}

export function parseWorkspaceFile(text: string): Graph {
    let value: unknown;
    try {
        value = JSON.parse(text);
    } catch {
        throw new Error('The file is not valid JSON.');
    }
    requireValid(
        isRecord(value) && Array.isArray(value.items) && Array.isArray(value.labels),
        'The file must contain items and labels arrays.'
    );
    requireValid(
        value.items.length <= 500 && value.labels.length <= 100,
        'A workspace supports up to 500 entries and 100 labels.'
    );
    const items = value.items.map((entry: unknown) => {
        validateEntry(entry);
        return entry;
    });
    const labels = value.labels.map((label: unknown) => {
        validateLabel(label);
        return label;
    });
    const byId = new Map(items.map((entry) => [entry.id, entry]));
    const labelIds = new Set(labels.map((label) => label.id));
    requireValid(byId.size === items.length, 'Entry IDs must be unique.');
    requireValid(
        labelIds.size === labels.length &&
            new Set(labels.map((label) => label.name.trim().toLowerCase())).size === labels.length,
        'Label IDs and names must be unique.'
    );
    requireValid(
        items.reduce((total, entry) => total + entry.childIds.length, 0) <= 300,
        'A workspace supports up to 300 connections.'
    );
    const visiting = new Set<string>();
    const visited = new Set<string>();
    function visit(entry: WorkspaceEntry): void {
        requireValid(!visiting.has(entry.id), 'Connections cannot contain cycles.');
        if (visited.has(entry.id)) return;
        visiting.add(entry.id);
        for (const childId of entry.childIds) {
            const child = byId.get(childId);
            requireValid(
                child && canContain(entry.type, child.type),
                'A connection is missing or has incompatible entry types.'
            );
            visit(child);
        }
        requireValid(
            entry.labelIds.every((id) => labelIds.has(id)),
            'An entry references an unknown label.'
        );
        visiting.delete(entry.id);
        visited.add(entry.id);
    }
    items.forEach(visit);
    const graph = { items, labels };
    requireValid(
        new Blob([JSON.stringify(graph)]).size <= 200 * 1024,
        'The workspace exceeds the 200 KB storage limit.'
    );
    return graph;
}

export function serializeWorkspace(graph: Graph): string {
    return JSON.stringify({ items: graph.items, labels: graph.labels }, null, 2);
}
