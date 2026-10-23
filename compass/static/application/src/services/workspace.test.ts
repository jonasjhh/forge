import { callWorkspace } from './workspace';
import type { SavedGraph } from '../types/workspace';

const key = 'compass-preview-v1';
const graph: SavedGraph = {
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

beforeEach(() => {
    localStorage.clear();
});
afterEach(() => {
    jest.restoreAllMocks();
});

test('given saved preview data, repeated loading preserves the graph and does not write', async () => {
    localStorage.setItem(key, JSON.stringify(graph));
    const write = jest.spyOn(Storage.prototype, 'setItem');
    const first = await callWorkspace('getGraph');
    const second = await callWorkspace('getGraph');
    expect(first.items[0].type).toBe('group');
    expect(first.items[0].childIds).toEqual(['goal']);
    expect(first.updatedAt).toBe(graph.updatedAt);
    expect(first.updatedBy).toBe(graph.updatedBy);
    expect(JSON.parse(localStorage.getItem(key)!).items[0].type).toBe('group');
    expect(second).toEqual(first);
    expect(first).toEqual({
        ...graph,
        items: [graph.items[0], { ...graph.items[1], goalCategory: 'Delivery' }]
    });
    expect(write).not.toHaveBeenCalled();
});

test('given canonical preview data, saving persists its entries and returns the saved graph', async () => {
    const saved = await callWorkspace('saveGraph', { items: graph.items, labels: graph.labels });
    expect(saved.items).toEqual(graph.items);
    expect(saved.updatedAt).toEqual(expect.any(String));
    expect(JSON.parse(localStorage.getItem(key)!)).toEqual(saved);
});

test('given no preview record, loading does not create one', async () => {
    const write = jest.spyOn(Storage.prototype, 'setItem');
    expect(await callWorkspace('getGraph')).toEqual({ items: [], labels: [], updatedAt: null });
    expect(write).not.toHaveBeenCalled();
});

test('given a storage write failure, preview saving rejects', async () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage unavailable');
    });
    await expect(
        callWorkspace('saveGraph', { items: graph.items, labels: graph.labels })
    ).rejects.toThrow('Storage unavailable');
});
