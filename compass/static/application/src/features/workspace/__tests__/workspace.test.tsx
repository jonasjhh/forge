import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { Network } from 'vis-network/standalone';
import App from '../../../app/App';
import ItemGraph from '../components/ItemGraph';
import AssigneeChip from '../../../components/assignees/AssigneeChip';
import { getUserAvatar } from '../../../services/jiraUsers';
import type { SavedGraph, WorkspaceEntry } from '../../../types/workspace';
import { buildListRows, matchesAssignees, moveGoalToFolder, moveListEntry } from '../model/entries';

test('given several selected assignees, entries matching any selected account are included', () => {
    const alice = { accountId: 'alice', displayName: 'Alice' };
    const bob = { accountId: 'bob', displayName: 'Bob' };
    const entries = [
        { id: 'alice-goal', assignees: [alice] },
        { id: 'bob-goal', assignees: [bob] },
        { id: 'other', assignees: [{ accountId: 'other', displayName: 'Alice' }] },
        { id: 'unassigned', assignees: [] }
    ];
    expect(
        entries.filter((entry) => matchesAssignees(entry, [alice, bob])).map((entry) => entry.id)
    ).toEqual(['alice-goal', 'bob-goal']);
    expect(entries.filter((entry) => matchesAssignees(entry, [])).map((entry) => entry.id)).toEqual(
        ['alice-goal', 'bob-goal', 'other', 'unassigned']
    );
});

test('given the assignee filter, selecting people uses OR matching and clear all restores unrelated rows', async () => {
    const alice = { accountId: 'preview-alice', displayName: 'Alice' };
    const bob = { accountId: 'preview-bob', displayName: 'Bob' };
    localStorage.setItem(
        'compass-preview-v1',
        JSON.stringify({
            items: [
                {
                    id: 'folder',
                    type: 'folder',
                    name: 'Strategy',
                    description: '',
                    childIds: ['parent', 'unrelated'],
                    assignees: []
                },
                {
                    id: 'parent',
                    type: 'goal',
                    name: 'Parent',
                    description: '',
                    childIds: ['metric'],
                    assignees: []
                },
                {
                    id: 'metric',
                    type: 'metric',
                    name: 'Assigned metric',
                    description: '',
                    childIds: [],
                    assignees: [alice]
                },
                {
                    id: 'bob-goal',
                    type: 'goal',
                    name: 'Bob goal',
                    description: '',
                    childIds: [],
                    assignees: [bob]
                },
                {
                    id: 'unrelated',
                    type: 'goal',
                    name: 'Unrelated',
                    description: '',
                    childIds: [],
                    assignees: []
                }
            ],
            updatedAt: null
        })
    );
    await act(async () => {
        ReactDOM.render(<App />, container);
    });
    act(() => {
        const filter = required(container.querySelector<HTMLDetailsElement>('.assignee-filter'));
        filter.open = true;
        Simulate.toggle(filter);
    });
    await act(async () => {
        Simulate.click(
            required(
                [
                    ...container.querySelectorAll<HTMLElement>(
                        '.assignee-filter .user-results button'
                    )
                ].find((button) => button.textContent?.endsWith('Alice'))
            )
        );
    });
    expect(
        [...container.querySelectorAll<HTMLElement>('.entry-row')].map((row) => row.dataset.entryId)
    ).toEqual(['folder', 'parent', 'metric']);
    expect(required(container.querySelector('.connection-count')).textContent).toBe('1 match');
    await act(async () => {
        Simulate.click(
            required(
                [
                    ...container.querySelectorAll<HTMLElement>(
                        '.assignee-filter .user-results button'
                    )
                ].find((button) => button.textContent?.endsWith('Bob'))
            )
        );
    });
    expect(
        [...container.querySelectorAll<HTMLElement>('.entry-row')].map((row) => row.dataset.entryId)
    ).toEqual(['folder', 'parent', 'metric', 'bob-goal']);
    await act(async () => {
        Simulate.click(required(container.querySelector('.clear-assignee-filter')));
    });
    expect(container.querySelector('[data-entry-id="unrelated"]')).not.toBeNull();
    expect(container.querySelector('.column-folder')).toBeNull();
});

test('given folder editing in details, saving a new folder preserves goal-parent relationships and metrics', async () => {
    localStorage.setItem(
        'compass-preview-v1',
        JSON.stringify({
            items: [
                {
                    id: 'old-folder',
                    type: 'folder',
                    name: 'Old folder',
                    description: '',
                    childIds: ['goal'],
                    assignees: []
                },
                {
                    id: 'new-folder',
                    type: 'folder',
                    name: 'New folder',
                    description: '',
                    childIds: [],
                    assignees: []
                },
                {
                    id: 'parent',
                    type: 'goal',
                    name: 'Parent',
                    description: '',
                    childIds: ['goal'],
                    assignees: []
                },
                {
                    id: 'goal',
                    type: 'goal',
                    name: 'Shared goal',
                    description: '',
                    childIds: ['metric'],
                    assignees: []
                },
                {
                    id: 'metric',
                    type: 'metric',
                    name: 'Metric',
                    description: '',
                    childIds: [],
                    assignees: []
                }
            ],
            updatedAt: null
        })
    );
    await act(async () => {
        ReactDOM.render(<App />, container);
    });
    act(() => {
        Simulate.click(required(container.querySelector('[aria-label="Open goal Shared goal"]')));
    });
    act(() => {
        changeValue(required(container.querySelector('#goal-folder')), 'new-folder');
    });
    await act(async () => {
        Simulate.submit(required(container.querySelector('.details > form')));
    });
    const saved = savedGraph().items;
    expect(required(saved.find((entry) => entry.id === 'old-folder')).childIds).toEqual([]);
    expect(required(saved.find((entry) => entry.id === 'new-folder')).childIds).toEqual(['goal']);
    expect(required(saved.find((entry) => entry.id === 'parent')).childIds).toEqual(['goal']);
    expect(required(saved.find((entry) => entry.id === 'goal')).childIds).toEqual(['metric']);
});

test('given an assignee-matched metric, all parent goals and folder ancestors remain visible without unrelated siblings', () => {
    const alice = { accountId: 'alice', displayName: 'Alice' };
    const items = [
        entryFixture({
            id: 'folder',
            type: 'folder',
            childIds: ['first', 'unrelated'],
            assignees: []
        }),
        entryFixture({ id: 'first', type: 'goal', childIds: ['shared'], assignees: [] }),
        entryFixture({ id: 'second', type: 'goal', childIds: ['shared'], assignees: [] }),
        entryFixture({ id: 'shared', type: 'goal', childIds: ['metric'], assignees: [] }),
        entryFixture({ id: 'metric', type: 'metric', childIds: [], assignees: [alice] }),
        entryFixture({ id: 'unrelated', type: 'goal', childIds: [], assignees: [] })
    ];
    const matches = items.filter((entry) => matchesAssignees(entry, [alice]));
    expect(buildListRows(items, matches).map((row) => row.entry.id)).toEqual([
        'folder',
        'first',
        'shared',
        'metric',
        'second',
        'shared',
        'metric'
    ]);
});

test('given sibling goals, dragging before another goal persists their child order', () => {
    const items = [
        entryFixture({ id: 'folder', type: 'folder', childIds: ['first', 'second'] }),
        entryFixture({ id: 'first', type: 'goal', childIds: [] }),
        entryFixture({ id: 'second', type: 'goal', childIds: [] })
    ];
    expect(moveListEntry(items, 'folder/second', 'folder/first', 'before')[0].childIds).toEqual([
        'second',
        'first'
    ]);
});

test('given a shared goal, moving one occurrence preserves its other parent and metrics', () => {
    const items = [
        entryFixture({ id: 'first', type: 'goal', childIds: ['shared'] }),
        entryFixture({ id: 'second', type: 'goal', childIds: ['shared'] }),
        entryFixture({ id: 'folder', type: 'folder', childIds: [] }),
        entryFixture({ id: 'shared', type: 'goal', childIds: ['metric'] }),
        entryFixture({ id: 'metric', type: 'metric', childIds: [] })
    ];
    const moved = moveListEntry(items, 'first/shared', 'folder', 'inside');
    expect(required(moved.find((entry) => entry.id === 'first')).childIds).toEqual([]);
    expect(required(moved.find((entry) => entry.id === 'second')).childIds).toEqual(['shared']);
    expect(required(moved.find((entry) => entry.id === 'folder')).childIds).toEqual(['shared']);
    expect(required(moved.find((entry) => entry.id === 'shared')).childIds).toEqual(['metric']);
});

test('given a descendant drop, dragging a parent beneath its child is rejected', () => {
    const items = [
        entryFixture({ id: 'parent', type: 'goal', childIds: ['child'] }),
        entryFixture({ id: 'child', type: 'goal', childIds: [] })
    ];
    expect(() => moveListEntry(items, 'parent', 'parent/child', 'inside')).toThrow(
        /beneath itself/
    );
});

test('given a metric, dragging it into a folder is rejected', () => {
    const items = [
        entryFixture({ id: 'goal', type: 'goal', childIds: ['metric'] }),
        entryFixture({ id: 'metric', type: 'metric', childIds: [] }),
        entryFixture({ id: 'folder', type: 'folder', childIds: [] })
    ];
    expect(() => moveListEntry(items, 'goal/metric', 'folder', 'inside')).toThrow(
        /Folders contain/
    );
});

test('given root entries, dragging changes their saved list order', () => {
    const items = [
        entryFixture({ id: 'goal', type: 'goal', childIds: [] }),
        entryFixture({ id: 'folder', type: 'folder', childIds: [] })
    ];
    expect(moveListEntry(items, 'folder', 'goal', 'before').map((entry) => entry.id)).toEqual([
        'folder',
        'goal'
    ]);
});

test('given a Jira avatar URL, the user chip shows the image and name and falls back to initials on failure', async () => {
    const user = {
        accountId: 'jira-alex',
        displayName: 'Alex Morgan',
        avatarUrl:
            'https://avatar-management--avatars.us-west-2.prod.public.atl-paas.net/initials/AM-5.png'
    };
    await act(async () => {
        ReactDOM.render(<AssigneeChip user={user} />, container);
    });
    expect(required(container.querySelector('.assignee-name')).textContent).toBe('Alex Morgan');
    expect(required(container.querySelector('img')).src).toBe(user.avatarUrl);
    act(() => {
        Simulate.error(required(container.querySelector('img')));
    });
    expect(required(container.querySelector('.assignee-avatar')).textContent).toBe('AM');
});

test('given Jira avatar metadata, only approved HTTPS image hosts are used', () => {
    expect(
        getUserAvatar({ avatarUrls: { '48x48': 'https://example.atlassian.net/avatar.png' } })
    ).toBe('https://example.atlassian.net/avatar.png');
    expect(getUserAvatar({ avatarUrl: 'https://untrusted.example/avatar.png' })).toBeNull();
    expect(getUserAvatar({ avatarUrl: 'http://example.atlassian.net/avatar.png' })).toBeNull();
});

jest.mock('vis-network/standalone', () => ({
    Network: jest.fn()
}));

interface GraphMockData {
    nodes: Array<{ id: string }>;
    edges: Array<{ from: string; to: string }>;
}
interface NetworkMock {
    on: jest.Mock;
    once: jest.Mock;
    destroy: jest.Mock;
    selectNodes: jest.Mock;
}
const mockNetwork = Network as unknown as jest.Mock<NetworkMock, [HTMLElement, GraphMockData]>;

function required<Value>(value: Value | null | undefined): Value {
    if (value === null || value === undefined)
        throw new Error('Expected fixture or DOM element was not found.');
    return value;
}

function savedGraph(): SavedGraph {
    return JSON.parse(required(localStorage.getItem('compass-preview-v1'))) as SavedGraph;
}

function entryFixture(entry: Pick<WorkspaceEntry, 'id'> & Partial<WorkspaceEntry>): WorkspaceEntry {
    return {
        name: entry.id,
        description: '',
        childIds: [],
        assignees: [],
        type: 'folder',
        ...entry
    };
}

function changeValue(element: Element | null, value: string): void {
    if (!(
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
    ))
        throw new Error('Expected a form field.');
    element.value = value;
    Simulate.change(element);
}

let container: HTMLDivElement;

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function () {
        this.open = true;
    };
    HTMLDialogElement.prototype.close = function () {
        this.open = false;
    };
});

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    localStorage.clear();
    jest.clearAllMocks();
    Object.defineProperty(window, 'crypto', {
        configurable: true,
        value: { randomUUID: jest.fn(() => 'created-entry') }
    });
    mockNetwork.mockImplementation(
        (element: HTMLElement, data: { nodes: Array<{ id: string }> }) => ({
            on: jest.fn(),
            once: jest.fn(),
            destroy: jest.fn(),
            selectNodes: jest.fn((selectedIds: string[]) => {
                if (selectedIds.some((id) => !data.nodes.some((node) => node.id === id))) {
                    throw new Error('Selected node is missing from the graph.');
                }
            })
        })
    );
});

afterEach(() => {
    act(() => {
        ReactDOM.unmountComponentAtNode(container);
    });
    container.remove();
    jest.restoreAllMocks();
});

test('given a selected parent, deleting it preserves its child and clears the selection', async () => {
    localStorage.setItem(
        'compass-preview-v1',
        JSON.stringify({
            items: [
                { id: 'platform', name: 'Platform', description: '', childIds: ['identity'] },
                { id: 'identity', name: 'Identity', description: '', childIds: [] }
            ],
            updatedAt: null
        })
    );
    await act(async () => {
        ReactDOM.render(<App />, container);
    });
    act(() => {
        Simulate.click(required(container.querySelector('[aria-label="Open folder Platform"]')));
    });
    act(() => {
        Simulate.click(required(container.querySelector('[aria-label="Delete folder"]')));
    });

    await act(async () => {
        Simulate.submit(required(container.querySelector('dialog form')));
    });

    expect(container.querySelector('dialog')).toBeNull();
    expect(container.querySelectorAll<HTMLElement>('.entry-row')).toHaveLength(1);
    expect(required(container.querySelector('.goal-name-text')).textContent).toBe('Identity');
    expect(savedGraph().items).toEqual([
        {
            id: 'identity',
            name: 'Identity',
            description: '',
            childIds: [],
            type: 'folder',
            assignees: []
        }
    ]);
});

test('given a stale selected ID, the graph clears the selection instead of selecting a missing node', () => {
    const items = [
        entryFixture({ id: 'identity', name: 'Identity', description: '', childIds: [] })
    ];

    act(() => {
        ReactDOM.render(
            <ItemGraph
                items={items}
                selectedId="deleted-platform"
                mode="graph"
                onSelect={() => {}}
            />,
            container
        );
    });

    expect(mockNetwork.mock.results[0].value.selectNodes).toHaveBeenCalledWith([], false);
});

test('given a goal, creating an assigned metric saves its values and parent connection', async () => {
    localStorage.setItem(
        'compass-preview-v1',
        JSON.stringify({
            items: [
                {
                    id: 'folder',
                    type: 'folder',
                    name: 'Strategy',
                    description: '',
                    childIds: ['goal'],
                    assignees: []
                },
                {
                    id: 'goal',
                    type: 'goal',
                    name: 'Customer experience',
                    description: '',
                    childIds: [],
                    assignees: []
                }
            ],
            updatedAt: null
        })
    );
    await act(async () => {
        ReactDOM.render(<App />, container);
    });
    act(() => {
        Simulate.click(
            required(container.querySelector('[aria-label="Open goal Customer experience"]'))
        );
    });
    act(() => {
        Simulate.click(
            required(
                [...container.querySelectorAll<HTMLElement>('button')].find(
                    (button) => button.textContent?.trim() === 'Add metric'
                )
            )
        );
    });
    act(() => {
        changeValue(required(container.querySelector('#new-name')), 'Response time');
        changeValue(required(container.querySelector('#new-assignees')), 'Alex');
    });
    act(() => {
        changeValue(required(container.querySelector('#new-metric-currentValue')), '8');
    });
    act(() => {
        changeValue(required(container.querySelector('#new-metric-targetValue')), '2');
    });
    act(() => {
        changeValue(required(container.querySelector('#new-metric-unit')), 'hours');
    });
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
    });
    act(() => {
        Simulate.click(
            required(
                [...container.querySelectorAll<HTMLElement>('.user-results button')].find(
                    (button) => button.textContent === 'Alex Morgan'
                )
            )
        );
    });

    await act(async () => {
        Simulate.submit(required(container.querySelector('dialog form')));
    });

    const saved = savedGraph();
    expect(required(saved.items.find((entry) => entry.id === 'created-entry'))).toEqual({
        id: 'created-entry',
        type: 'metric',
        name: 'Response time',
        description: '',
        childIds: [],
        currentValue: 8,
        targetValue: 2,
        unit: 'hours',
        assignees: [{ accountId: 'preview-alex', displayName: 'Alex Morgan' }]
    });
    expect(required(saved.items.find((entry) => entry.id === 'goal')).childIds).toEqual([
        'created-entry'
    ]);
});

test('given folders and shared goals, the graph hides folders and keeps every goal parent and metric', () => {
    const items = [
        entryFixture({
            id: 'folder',
            type: 'folder',
            name: 'Strategy',
            childIds: ['first', 'second']
        }),
        entryFixture({ id: 'first', type: 'goal', name: 'First', childIds: ['shared'] }),
        entryFixture({ id: 'second', type: 'goal', name: 'Second', childIds: ['shared'] }),
        entryFixture({ id: 'shared', type: 'goal', name: 'Shared', childIds: ['metric'] }),
        entryFixture({ id: 'metric', type: 'metric', name: 'Metric', childIds: [] })
    ];
    act(() => {
        ReactDOM.render(
            <ItemGraph items={items} selectedId="folder" mode="tree" onSelect={() => {}} />,
            container
        );
    });
    const data: GraphMockData = mockNetwork.mock.calls[0][1];
    expect(data.nodes.map((node) => node.id)).toEqual(['first', 'second', 'shared', 'metric']);
    expect(data.edges).toEqual([
        { from: 'first', to: 'shared' },
        { from: 'second', to: 'shared' },
        { from: 'shared', to: 'metric' }
    ]);
    expect(mockNetwork.mock.results[0].value.selectNodes).toHaveBeenCalledWith([], false);
});

test('given a goal moved between folders, its goal parents and metric relationships remain unchanged', () => {
    const items = [
        entryFixture({ id: 'first-folder', type: 'folder', childIds: ['shared'] }),
        entryFixture({ id: 'second-folder', type: 'folder', childIds: [] }),
        entryFixture({ id: 'first-goal', type: 'goal', childIds: ['shared'] }),
        entryFixture({ id: 'second-goal', type: 'goal', childIds: ['shared'] }),
        entryFixture({ id: 'shared', type: 'goal', childIds: ['metric'] }),
        entryFixture({ id: 'metric', type: 'metric', childIds: [] })
    ];
    const moved = moveGoalToFolder(items, 'shared', 'second-folder');
    expect(moved.filter((entry) => entry.type === 'goal')).toEqual(
        items.filter((entry) => entry.type === 'goal')
    );
    expect(required(moved.find((entry) => entry.id === 'first-folder')).childIds).toEqual([]);
    expect(required(moved.find((entry) => entry.id === 'second-folder')).childIds).toEqual([
        'shared'
    ]);
});

test('given inline folders, shared branches and ungrouped roots remain visible in the hierarchy', () => {
    const items = [
        entryFixture({ id: 'folder', type: 'folder', childIds: ['first', 'second'] }),
        entryFixture({ id: 'first', type: 'goal', childIds: ['shared'] }),
        entryFixture({ id: 'second', type: 'goal', childIds: ['shared'] }),
        entryFixture({ id: 'shared', type: 'goal', childIds: ['metric'] }),
        entryFixture({ id: 'metric', type: 'metric', childIds: [] }),
        entryFixture({ id: 'ungrouped', type: 'goal', childIds: [] })
    ];
    expect(buildListRows(items, items).map((row) => row.entry.id)).toEqual([
        'folder',
        'first',
        'shared',
        'metric',
        'second',
        'shared',
        'metric',
        'ungrouped'
    ]);
});

test('given an empty workspace, the list creates a goal without a folder or parent', async () => {
    await act(async () => {
        ReactDOM.render(<App />, container);
    });
    act(() => {
        Simulate.click(
            required(
                [...container.querySelectorAll<HTMLElement>('button')].find(
                    (button) => button.textContent?.trim() === 'New goal'
                )
            )
        );
    });
    act(() => {
        changeValue(required(container.querySelector('#new-name')), 'Independent goal');
    });
    await act(async () => {
        Simulate.submit(required(container.querySelector('dialog form')));
    });
    expect(container.querySelector('[aria-label="Open goal Independent goal"]')).not.toBeNull();
    expect(savedGraph().items[0].type).toBe('goal');
});

test('given a sub-goal, linking and unlinking one parent leaves the other parent and metrics intact', async () => {
    localStorage.setItem(
        'compass-preview-v1',
        JSON.stringify({
            items: [
                {
                    id: 'first',
                    type: 'goal',
                    name: 'First',
                    description: '',
                    childIds: ['shared'],
                    assignees: []
                },
                {
                    id: 'second',
                    type: 'goal',
                    name: 'Second',
                    description: '',
                    childIds: [],
                    assignees: []
                },
                {
                    id: 'shared',
                    type: 'goal',
                    name: 'Shared',
                    description: '',
                    childIds: ['metric'],
                    assignees: []
                },
                {
                    id: 'metric',
                    type: 'metric',
                    name: 'Metric',
                    description: '',
                    childIds: [],
                    assignees: [],
                    currentValue: 0,
                    targetValue: 100,
                    unit: '%'
                }
            ],
            updatedAt: null
        })
    );
    await act(async () => {
        ReactDOM.render(<App />, container);
    });
    act(() => {
        Simulate.click(required(container.querySelector('[aria-label="Open goal Shared"]')));
    });
    act(() => {
        changeValue(required(container.querySelector('#parent-goal')), 'second');
    });
    await act(async () => {
        Simulate.submit(
            required(required(container.querySelector('#parent-goal')).closest('form'))
        );
    });
    expect(container.querySelector('[aria-label="Unlink parent First"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Unlink parent Second"]')).not.toBeNull();
    await act(async () => {
        Simulate.click(required(container.querySelector('[aria-label="Unlink parent First"]')));
    });
    const saved = savedGraph().items;
    expect(required(saved.find((entry) => entry.id === 'first')).childIds).toEqual([]);
    expect(required(saved.find((entry) => entry.id === 'second')).childIds).toEqual(['shared']);
    expect(required(saved.find((entry) => entry.id === 'shared')).childIds).toEqual(['metric']);
});

test('given folders and nested goals, inline rows follow their parent with increasing indentation', () => {
    const items = [
        entryFixture({ id: 'metric', type: 'metric', childIds: [] }),
        entryFixture({ id: 'child', type: 'goal', childIds: ['metric'] }),
        entryFixture({ id: 'parent', type: 'goal', childIds: ['child'] }),
        entryFixture({ id: 'folder', type: 'folder', childIds: ['parent'] })
    ];
    expect(buildListRows(items, items).map(({ entry, depth }) => [entry.id, depth])).toEqual([
        ['folder', 0],
        ['parent', 1],
        ['child', 2],
        ['metric', 3]
    ]);
});

test('given a shared sub-goal, it appears beneath each parent using the same saved entry', () => {
    const shared = entryFixture({ id: 'shared', type: 'goal', childIds: [] });
    const items = [
        entryFixture({ id: 'first', type: 'goal', childIds: ['shared'] }),
        entryFixture({ id: 'second', type: 'goal', childIds: ['shared'] }),
        entryFixture(shared)
    ];
    const rows = buildListRows(items, items);
    expect(rows.map(({ entry, depth }) => [entry.id, depth])).toEqual([
        ['first', 0],
        ['shared', 1],
        ['second', 0],
        ['shared', 1]
    ]);
    expect(rows.filter((row) => row.entry.id === 'shared').map((row) => row.entry)).toEqual([
        shared,
        shared
    ]);
});

test('given a collapsed folder, descendants stay hidden until that branch is expanded', () => {
    const items = [
        entryFixture({ id: 'folder', type: 'folder', childIds: ['goal'] }),
        entryFixture({ id: 'goal', type: 'goal', childIds: [] })
    ];
    expect(buildListRows(items, items, new Set(['folder'])).map((row) => row.entry.id)).toEqual([
        'folder'
    ]);
});

test('given a matching metric, filtering retains its folder and goal ancestors as context', () => {
    const items = [
        entryFixture({ id: 'folder', type: 'folder', childIds: ['goal'] }),
        entryFixture({ id: 'goal', type: 'goal', childIds: ['metric'] }),
        entryFixture({ id: 'metric', type: 'metric', childIds: [] })
    ];
    expect(buildListRows(items, [items[2]]).map((row) => row.entry.id)).toEqual([
        'folder',
        'goal',
        'metric'
    ]);
});

test('given a row limit, hierarchy projection stops without expanding all shared branches', () => {
    const items = [
        entryFixture({ id: 'first', type: 'goal', childIds: ['shared'] }),
        entryFixture({ id: 'second', type: 'goal', childIds: ['shared'] }),
        entryFixture({ id: 'shared', type: 'goal', childIds: [] })
    ];
    expect(buildListRows(items, items, new Set(), 2).map((row) => row.entry.id)).toEqual([
        'first',
        'shared'
    ]);
});
