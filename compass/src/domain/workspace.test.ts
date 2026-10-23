import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWorkspace, workspaceKey } from './workspace';
import type { SavedGraph } from '../../shared/workspace';

function workspaceStorage(initial: unknown) {
    let stored = initial;
    const writes: SavedGraph[] = [];
    return {
        writes,
        get: async () => stored,
        set: async (_key: string, value: SavedGraph) => {
            writes.push(value);
            stored = value;
        }
    };
}

const workspace: SavedGraph = {
    items: [
        {
            id: 'group',
            type: 'group',
            name: 'Strategy',
            description: '',
            childIds: ['goal'],
            assignees: [],
            labelIds: []
        },
        {
            id: 'goal',
            type: 'goal',
            name: 'Goal',
            description: '',
            childIds: [],
            assignees: [],
            labelIds: []
        }
    ],
    labels: [],
    updatedAt: '2026-10-22T00:00:00.000Z',
    updatedBy: 'original-editor'
};

test('given different signed-in users, both use the same workspace', () => {
    assert.equal(workspaceKey({ accountId: 'alice' }), workspaceKey({ accountId: 'bob' }));
});

test('given an anonymous request, workspace access is rejected', () => {
    assert.throws(() => workspaceKey({}), /Sign in/);
});

test('given missing request context, workspace access is rejected', () => {
    assert.throws(() => workspaceKey(undefined), /Sign in/);
});

test('given a stored graph, loading preserves data and metadata without writing', async () => {
    const storage = workspaceStorage(workspace);
    const first = await loadWorkspace(storage, 'shared');
    const second = await loadWorkspace(storage, 'shared');
    assert.equal(storage.writes.length, 0);
    assert.equal(first.items[0].type, 'group');
    assert.deepEqual(first.items[0].childIds, ['goal']);
    assert.equal(first.updatedAt, workspace.updatedAt);
    assert.equal(first.updatedBy, workspace.updatedBy);
    assert.deepEqual(second, first);
    assert.deepEqual(first, {
        ...workspace,
        items: workspace.items.map((item) =>
            item.type === 'goal' ? { ...item, goalCategory: 'Delivery' } : item
        )
    });
});

test('given an empty installation, loading does not create a storage record', async () => {
    const storage = workspaceStorage(undefined);
    assert.deepEqual(await loadWorkspace(storage, 'shared'), {
        items: [],
        labels: [],
        updatedAt: null
    });
    assert.equal(storage.writes.length, 0);
});

test('given invalid stored relationships, loading rejects without writing', async () => {
    const storage = workspaceStorage({
        ...workspace,
        items: [{ ...workspace.items[0], childIds: ['missing'] }]
    });
    await assert.rejects(loadWorkspace(storage, 'shared'), /no longer exists/);
    assert.equal(storage.writes.length, 0);
});
