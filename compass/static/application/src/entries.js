export const entryTypes = {
    folder: { label: 'Folder', plural: 'Folders', color: '#dcfff1', border: '#1f845a' },
    goal: { label: 'Goal', plural: 'Goals', color: '#e9f2ff', border: '#0c66e4' },
    metric: { label: 'Metric', plural: 'Metrics', color: '#fff7d6', border: '#946f00' }
};

export function normalizeEntry(entry) {
    return { ...entry, type: entry.type || 'folder', assignees: entry.assignees || [] };
}

export function canContain(parentType, childType) {
    return parentType === 'folder'
        ? ['folder', 'goal'].includes(childType)
        : parentType === 'goal' && ['goal', 'metric'].includes(childType);
}

export function canConnect(items, parent, child) {
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

export function moveGoalToFolder(items, goalId, folderId) {
    return items.map((entry) =>
        entry.type !== 'folder'
            ? entry
            : {
                  ...entry,
                  childIds: [
                      ...entry.childIds.filter((id) => id !== goalId),
                      ...(entry.id === folderId ? [goalId] : [])
                  ]
              }
    );
}

export function buildListRows(items, entries, collapsedPaths = new Set(), maxRows = 500) {
    const byId = new Map(items.map((entry) => [entry.id, entry]));
    const parents = new Map(items.map((entry) => [entry.id, []]));
    items.forEach((entry) =>
        entry.childIds.forEach((childId) => parents.get(childId)?.push(entry.id))
    );
    const included = new Set(entries.map((entry) => entry.id));
    const pending = [...included];
    while (pending.length) {
        const current = pending.pop();
        (parents.get(current) || []).forEach((parentId) => {
            if (!included.has(parentId)) {
                included.add(parentId);
                pending.push(parentId);
            }
        });
    }

    const rows = [];
    function append(entry, depth, parentPath, ancestors) {
        if (ancestors.has(entry.id) || rows.length >= maxRows) return;
        const path = parentPath ? `${parentPath}/${entry.id}` : entry.id;
        const children = entry.childIds.filter(
            (childId) => included.has(childId) && byId.has(childId)
        );
        rows.push({ entry, depth, path, hasChildren: children.length > 0 });
        if (collapsedPaths.has(path)) return;
        const nextAncestors = new Set([...ancestors, entry.id]);
        children.forEach((childId) => append(byId.get(childId), depth + 1, path, nextAncestors));
    }
    const ordered = [
        ...items.filter((entry) => entry.type === 'folder'),
        ...items.filter((entry) => entry.type !== 'folder')
    ];
    ordered
        .filter(
            (entry) =>
                included.has(entry.id) &&
                !(parents.get(entry.id) || []).some((parentId) => included.has(parentId))
        )
        .forEach((entry) => append(entry, 0, '', new Set()));
    return rows;
}
