import type {
    Assignee,
    DropPlacement,
    EntryType,
    ListRow,
    WorkspaceEntry
} from '../../../types/workspace';

export const entryTypes: Record<
    EntryType,
    { label: string; plural: string; color: string; border: string }
> = {
    group: { label: 'Group', plural: 'Groups', color: '#dcfff1', border: '#1f845a' },
    goal: { label: 'Goal', plural: 'Goals', color: '#e9f2ff', border: '#0c66e4' },
    metric: { label: 'Metric', plural: 'Metrics', color: '#fff7d6', border: '#946f00' }
};

export const goalCategories = ['Decision', 'Capability', 'Delivery'] as const;

export function matchesAssignees(
    entry: Pick<WorkspaceEntry, 'assignees'>,
    selectedAssignees: Assignee[]
): boolean {
    return (
        selectedAssignees.length === 0 ||
        entry.assignees.some((assignee) =>
            selectedAssignees.some((selected) => selected.accountId === assignee.accountId)
        )
    );
}

export function canContain(parentType: EntryType, childType: EntryType): boolean {
    return parentType === 'group'
        ? ['group', 'goal'].includes(childType)
        : parentType === 'goal' && ['goal', 'metric'].includes(childType);
}

export function canConnect(
    items: WorkspaceEntry[],
    parent: WorkspaceEntry,
    child: WorkspaceEntry
): boolean {
    if (!canContain(parent.type, child.type) || parent.childIds.includes(child.id)) return false;
    const remaining = [child.id];
    const visited = new Set();
    while (remaining.length) {
        const current = remaining.pop();
        if (current === parent.id) return false;
        if (visited.has(current)) continue;
        visited.add(current);
        const entry = items.find((candidate) => candidate.id === current);
        if (entry) remaining.push(...entry.childIds);
    }
    return true;
}

export function moveGoalToGroup(
    items: WorkspaceEntry[],
    goalId: string,
    groupId: string
): WorkspaceEntry[] {
    return items.map((entry) =>
        entry.type !== 'group'
            ? entry
            : {
                  ...entry,
                  childIds: [
                      ...entry.childIds.filter((id) => id !== goalId),
                      ...(entry.id === groupId ? [goalId] : [])
                  ]
              }
    );
}

export function buildListRows(
    items: WorkspaceEntry[],
    entries: WorkspaceEntry[],
    collapsedPaths = new Set<string>(),
    maxRows = 500
): ListRow[] {
    const byId = new Map(items.map((entry) => [entry.id, entry]));
    const parents = new Map<string, string[]>(items.map((entry) => [entry.id, []]));
    items.forEach((entry) =>
        entry.childIds.forEach((childId) => parents.get(childId)?.push(entry.id))
    );
    const included = new Set(entries.map((entry) => entry.id));
    const pending = [...included];
    while (pending.length) {
        const current = pending.pop()!;
        (parents.get(current) || []).forEach((parentId) => {
            if (!included.has(parentId)) {
                included.add(parentId);
                pending.push(parentId);
            }
        });
    }

    const rows: ListRow[] = [];
    function append(
        entry: WorkspaceEntry,
        depth: number,
        parentPath: string,
        ancestors: Set<string>
    ): void {
        if (ancestors.has(entry.id) || rows.length >= maxRows) return;
        const path = parentPath ? `${parentPath}/${entry.id}` : entry.id;
        const children = entry.childIds.filter(
            (childId) => included.has(childId) && byId.has(childId)
        );
        rows.push({ entry, depth, path, hasChildren: children.length > 0 });
        if (collapsedPaths.has(path)) return;
        const nextAncestors = new Set([...ancestors, entry.id]);
        children.forEach((childId) => append(byId.get(childId)!, depth + 1, path, nextAncestors));
    }
    items
        .filter(
            (entry) =>
                included.has(entry.id) &&
                !(parents.get(entry.id) || []).some((parentId) => included.has(parentId))
        )
        .forEach((entry) => append(entry, 0, '', new Set()));
    return rows;
}

export function moveListEntry(
    items: WorkspaceEntry[],
    sourcePath: string,
    targetPath: string,
    placement: DropPlacement
): WorkspaceEntry[] {
    if (!['before', 'inside', 'after'].includes(placement))
        throw new Error('Choose a valid drop position.');
    const sourceParts = sourcePath.split('/');
    const targetParts = targetPath.split('/');
    const sourceId = sourceParts[sourceParts.length - 1];
    const targetId = targetParts[targetParts.length - 1];
    const sourceParentId = sourceParts[sourceParts.length - 2] || null;
    const destinationParentId =
        placement === 'inside' ? targetId : targetParts[targetParts.length - 2] || null;
    const source = items.find((entry) => entry.id === sourceId);
    const target = items.find((entry) => entry.id === targetId);
    if (!source || !target)
        throw new Error('This entry is no longer available. Refresh the workspace.');
    if (sourceId === targetId) return items;
    if (targetPath.startsWith(`${sourcePath}/`))
        throw new Error('An entry cannot be moved beneath itself.');
    const destination = items.find((entry) => entry.id === destinationParentId);
    if (destination) {
        if (!canContain(destination.type, source.type))
            throw new Error('Groups contain groups or goals; goals contain goals or metrics.');
        if (destinationParentId !== sourceParentId && !canConnect(items, destination, source))
            throw new Error('This move would duplicate a connection or create a cycle.');
    } else {
        if (source.type === 'metric') throw new Error('Metrics must stay beneath a goal.');
        if (items.some((entry) => entry.id !== sourceParentId && entry.childIds.includes(sourceId)))
            throw new Error(
                'This entry still has other parents. Move it beneath another parent instead.'
            );
    }
    const updated = items.map((entry) => {
        if (entry.id !== sourceParentId && entry.id !== destinationParentId) return entry;
        const childIds = entry.childIds.filter((id) => id !== sourceId);
        if (entry.id === destinationParentId) {
            const targetIndex = childIds.indexOf(targetId);
            const insertIndex =
                placement === 'inside'
                    ? childIds.length
                    : targetIndex + (placement === 'after' ? 1 : 0);
            childIds.splice(insertIndex, 0, sourceId);
        }
        return { ...entry, childIds };
    });
    if (destination) return updated;
    const remaining = updated.filter((entry) => entry.id !== sourceId);
    const targetIndex = remaining.findIndex((entry) => entry.id === targetId);
    remaining.splice(targetIndex + (placement === 'after' ? 1 : 0), 0, source);
    return remaining;
}
