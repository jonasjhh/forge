import { parseWorkspaceFile, serializeWorkspace } from './workspaceTransfer';
import type { Graph } from '../../../types/workspace';

const graph: Graph = {
    items: [
        {
            id: 'first',
            type: 'goal',
            name: 'First',
            description: '',
            childIds: ['shared'],
            assignees: [],
            labelIds: []
        },
        {
            id: 'second',
            type: 'goal',
            name: 'Second',
            description: '',
            childIds: ['shared'],
            assignees: [],
            labelIds: []
        },
        {
            id: 'shared',
            type: 'goal',
            name: 'Shared',
            description: 'Notes',
            childIds: [],
            assignees: [{ accountId: 'alice', displayName: 'Alice' }],
            labelIds: ['team'],
            goalCategory: 'Decision',
            status: 'yellow',
            targetDate: '2027-03'
        }
    ],
    labels: [{ id: 'team', name: 'Team', color: '#0c66e4' }]
};

test('given an export, importing preserves shared connections, order, labels, and assignees', () => {
    expect(parseWorkspaceFile(serializeWorkspace(graph))).toEqual(graph);
});

test.each(['not JSON', '{}', 'null', '[]', '{"items": []}', '{"items": {}, "labels": []}'])(
    'given invalid file contents %s, import is rejected',
    (contents) => {
        expect(() => parseWorkspaceFile(contents)).toThrow();
    }
);

test.each([
    { ...graph.items[0], childIds: ['missing'] },
    { ...graph.items[0], childIds: ['first'] },
    { ...graph.items[0], childIds: ['shared', 'shared'] },
    { ...graph.items[0], labelIds: ['unknown'] },
    { ...graph.items[0], targetDate: '2027-13' },
    { ...graph.items[0], status: 'blue' },
    { ...graph.items[0], name: 'x'.repeat(201) },
    { ...graph.items[0], type: 'unknown' },
    { ...graph.items[0], assignees: [{ displayName: 'Alice' }] }
])('given invalid entry data, import is rejected', (entry) => {
    expect(() =>
        parseWorkspaceFile(
            serializeWorkspace({ ...graph, items: [entry, ...graph.items.slice(1)] } as Graph)
        )
    ).toThrow();
});

test('given duplicate entry IDs, import is rejected', () => {
    expect(() =>
        parseWorkspaceFile(
            serializeWorkspace({ ...graph, items: [...graph.items, graph.items[0]] })
        )
    ).toThrow(/unique/);
});

test('given an empty workspace export, importing it is allowed', () => {
    expect(parseWorkspaceFile('{"items":[],"labels":[]}')).toEqual({ items: [], labels: [] });
});

test.each([
    [{ id: 'team', name: 'Team', color: 'red' }],
    [{ id: 'team', name: '', color: '#0c66e4' }],
    [
        { id: 'team', name: 'Team', color: '#0c66e4' },
        { id: 'team', name: 'Other', color: '#0c66e4' }
    ],
    [
        { id: 'team', name: 'Team', color: '#0c66e4' },
        { id: 'other', name: 'TEAM', color: '#0c66e4' }
    ]
])('given invalid or duplicate labels, importing is rejected', (...labels) => {
    expect(() => parseWorkspaceFile(JSON.stringify({ items: [], labels }))).toThrow();
});

test('given incompatible child types, importing is rejected', () => {
    expect(() =>
        parseWorkspaceFile(
            JSON.stringify({
                items: [
                    { ...graph.items[0], type: 'metric', childIds: ['shared'] },
                    graph.items[2]
                ],
                labels: graph.labels
            })
        )
    ).toThrow(/incompatible/);
});

test('given 500 entries, importing preserves all entries', () => {
    const items = Array.from({ length: 500 }, (_, index) => ({
        ...graph.items[0],
        id: `goal-${index}`,
        childIds: []
    }));
    expect(parseWorkspaceFile(JSON.stringify({ items, labels: [] })).items).toEqual(items);
});

test('given more than 500 entries, importing is rejected', () => {
    const items = Array.from({ length: 501 }, (_, index) => ({
        ...graph.items[0],
        id: `goal-${index}`,
        childIds: []
    }));
    expect(() => parseWorkspaceFile(JSON.stringify({ items, labels: [] }))).toThrow(/500/);
});

test('given more than 100 children within the connection limit, importing preserves connections', () => {
    const children = Array.from({ length: 101 }, (_, index) => ({
        ...graph.items[0],
        id: `goal-${index}`,
        childIds: []
    }));
    const items = [{ ...graph.items[0], childIds: children.map((entry) => entry.id) }, ...children];
    expect(parseWorkspaceFile(JSON.stringify({ items, labels: [] })).items).toEqual(items);
});

test('given valid fields exceeding the storage limit in total, importing is rejected', () => {
    const assignees = Array.from({ length: 20 }, (_, index) => ({
        accountId: `user-${index}`,
        displayName: 'A'.repeat(200)
    }));
    const items = Array.from({ length: 100 }, (_, index) => ({
        ...graph.items[0],
        id: `goal-${index}`,
        childIds: [],
        assignees
    }));
    expect(() => parseWorkspaceFile(JSON.stringify({ items, labels: [] }))).toThrow(/200 KB/);
});
