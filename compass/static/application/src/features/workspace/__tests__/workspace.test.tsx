import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { Network } from 'vis-network/standalone';
import App from '../../../app/App';
import ItemGraph from '../components/ItemGraph';
import AssigneeChip from '../../../components/assignees/AssigneeChip';
import { getUserAvatar } from '../../../services/jiraUsers';
import * as jiraUsers from '../../../services/jiraUsers';
import type { SavedGraph, WorkspaceEntry } from '../../../types/workspace';
import { buildListRows, matchesAssignees, moveGoalToGroup, moveListEntry } from '../model/entries';

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

test('given the type dropdown, goal categories filter separately and retain matching ancestor chains', async () => {
    const items = [
        entryFixture({ id: 'group', type: 'group', childIds: ['goal'] }),
        entryFixture({ id: 'goal', type: 'goal', goalCategory: 'Decision', childIds: ['metric'] }),
        entryFixture({ id: 'metric', type: 'metric' }),
        entryFixture({ id: 'empty-group', type: 'group' })
    ];
    localStorage.setItem('compass-preview-v1', JSON.stringify({ items, updatedAt: null }));
    await act(async () => {
        ReactDOM.render(<App />, container);
    });
    const checkbox = (value: string) =>
        required(
            container.querySelector<HTMLInputElement>(`.checkbox-dropdown input[value="${value}"]`)
        );
    const setChecked = (value: string, checked: boolean) =>
        act(() => {
            checkbox(value).checked = checked;
            Simulate.change(checkbox(value));
        });

    expect(checkbox('all').checked).toBe(true);
    setChecked('group', false);
    expect(checkbox('Decision').checked).toBe(true);
    expect(checkbox('metric').checked).toBe(true);
    expect(checkbox('all').indeterminate).toBe(true);
    expect(
        [...container.querySelectorAll<HTMLElement>('.entry-row')].map((row) => row.dataset.entryId)
    ).toEqual(['group', 'goal', 'metric']);
    expect(required(container.querySelector('.connection-count')).textContent).toBe('2 matches');

    setChecked('Decision', false);
    expect(required(container.querySelector('.connection-count')).textContent).toBe('1 match');
    expect(
        [...container.querySelectorAll<HTMLElement>('.entry-row')].map((row) => row.dataset.entryId)
    ).toEqual(['group', 'goal', 'metric']);

    setChecked('all', false);
    expect(container.querySelector('.entry-row')).toBeNull();
    expect(checkbox('all').indeterminate).toBe(false);
    setChecked('all', true);
    expect(container.querySelector('[data-entry-id="empty-group"]')).not.toBeNull();
    expect(required(container.querySelector('.connection-count')).textContent).toBe('4 entries');
});

test('given a goal category, creating and changing it updates the list label and icon', async () => {
    await act(async () => {
        ReactDOM.render(<App />, container);
    });
    act(() => {
        Simulate.click(
            required(
                [...container.querySelectorAll<HTMLButtonElement>('.header-actions button')].find(
                    (button) => button.textContent?.includes('New goal')
                )
            )
        );
    });
    act(() => {
        changeValue(required(container.querySelector('#new-name')), 'Decision plan');
        changeValue(required(container.querySelector('#new-goal-category')), 'Capability');
    });
    await act(async () => {
        Simulate.submit(required(container.querySelector('dialog form')));
    });

    const created = required(savedGraph().items.find((item) => item.id === 'created-entry'));
    expect(created.goalCategory).toBe('Capability');
    const createdRow = required(container.querySelector('[data-entry-id="created-entry"]'));
    expect(createdRow.querySelector('.goal-row-meta')?.textContent).toBe('Capability');
    expect(createdRow.querySelector('.entry-icon-capability')).not.toBeNull();

    act(() => {
        Simulate.click(required(container.querySelector('[aria-label="Open goal Decision plan"]')));
        changeValue(required(container.querySelector('#goal-category')), 'Decision');
    });
    await act(async () => {
        Simulate.submit(required(container.querySelector('.details form')));
    });

    const updated = required(savedGraph().items.find((item) => item.id === 'created-entry'));
    expect(updated.goalCategory).toBe('Decision');
    const updatedRow = required(container.querySelector('[data-entry-id="created-entry"]'));
    expect(updatedRow.querySelector('.goal-row-meta')?.textContent).toBe('Decision');
    expect(updatedRow.querySelector('.entry-icon-decision')).not.toBeNull();

    const typeFilter = required(
        container.querySelector<HTMLDetailsElement>('.list-filters .checkbox-dropdown')
    );
    expect(typeFilter.querySelector('input[value="Decision"]')).not.toBeNull();
    expect(typeFilter.querySelector('input[value="Capability"]')).not.toBeNull();
    expect(typeFilter.querySelector('input[value="Delivery"]')).not.toBeNull();
});

test('given a workspace label, it can be created, assigned, filtered, and removed cleanly', async () => {
    localStorage.setItem(
        'compass-preview-v1',
        JSON.stringify({
            items: [
                entryFixture({ id: 'group', name: 'Workspace', childIds: ['goal'] }),
                entryFixture({ id: 'goal', type: 'goal', name: 'Platform' }),
                entryFixture({ id: 'other', name: 'Other group' })
            ],
            labels: [],
            updatedAt: null
        })
    );
    await act(async () => {
        ReactDOM.render(<App />, container);
    });

    act(() => {
        Simulate.click(
            required(
                [...container.querySelectorAll<HTMLButtonElement>('.view-switch button')].find(
                    (button) => button.textContent?.trim() === 'Labels'
                )
            )
        );
    });
    act(() => changeValue(required(container.querySelector('#new-label-name')), 'Platform team'));
    act(() => {
        Simulate.submit(required(container.querySelector('.label-create-form')));
    });
    await act(async () => {
        Simulate.click(
            required(
                [...container.querySelectorAll<HTMLButtonElement>('button')].find(
                    (button) => button.textContent?.trim() === 'Save labels'
                )
            )
        );
    });
    expect(savedGraph().labels).toEqual([
        { id: 'created-entry', name: 'Platform team', color: '#0c66e4' }
    ]);

    act(() => {
        Simulate.click(
            required(
                [...container.querySelectorAll<HTMLButtonElement>('.view-switch button')].find(
                    (button) => button.textContent?.trim() === 'List'
                )
            )
        );
    });
    act(() => {
        Simulate.click(required(container.querySelector('[aria-label="Open goal Platform"]')));
    });
    const detailLabels = required(
        container.querySelector<HTMLDetailsElement>('.details .checkbox-dropdown')
    );
    act(() => {
        detailLabels.open = true;
        Simulate.toggle(detailLabels);
        const checkbox = required(
            detailLabels.querySelector<HTMLInputElement>('input[value="created-entry"]')
        );
        checkbox.checked = true;
        Simulate.change(checkbox);
    });
    await act(async () => {
        Simulate.submit(required(container.querySelector('.details form')));
    });
    expect(required(savedGraph().items.find((entry) => entry.id === 'goal')).labelIds).toEqual([
        'created-entry'
    ]);
    expect(
        container.querySelector('.entry-row[data-entry-id="goal"] .workspace-label-chip')
            ?.textContent
    ).toBe('Platform team');

    const labelFilter = required(
        [
            ...container.querySelectorAll<HTMLDetailsElement>('.list-filters .checkbox-dropdown')
        ].find((dropdown) => dropdown.querySelector('summary[aria-label="Filter by label"]'))
    );
    act(() => {
        labelFilter.open = true;
        Simulate.toggle(labelFilter);
        const checkbox = required(
            labelFilter.querySelector<HTMLInputElement>('input[value="created-entry"]')
        );
        checkbox.checked = true;
        Simulate.change(checkbox);
    });
    expect(
        [...container.querySelectorAll<HTMLElement>('.entry-row')].map((row) => row.dataset.entryId)
    ).toEqual(['group', 'goal']);

    act(() => {
        Simulate.click(
            required(
                [...container.querySelectorAll<HTMLButtonElement>('.view-switch button')].find(
                    (button) => button.textContent?.trim() === 'Labels'
                )
            )
        );
    });
    act(() => {
        Simulate.click(
            required(container.querySelector('[aria-label="Remove label Platform team"]'))
        );
    });
    await act(async () => {
        Simulate.click(
            required(
                [...container.querySelectorAll<HTMLButtonElement>('button')].find(
                    (button) => button.textContent?.trim() === 'Save labels'
                )
            )
        );
    });
    expect(savedGraph().labels).toEqual([]);
    expect(required(savedGraph().items.find((entry) => entry.id === 'goal')).labelIds).toEqual([]);
});

test('given the assignee filter, selecting people uses OR matching and clear all restores unrelated rows', async () => {
    const alice = { accountId: 'preview-alice', displayName: 'Alice' };
    const bob = { accountId: 'preview-bob', displayName: 'Bob' };
    localStorage.setItem(
        'compass-preview-v1',
        JSON.stringify({
            items: [
                {
                    id: 'group',
                    type: 'group',
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
    ).toEqual(['group', 'parent', 'metric']);
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
    ).toEqual(['group', 'parent', 'metric', 'bob-goal']);
    await act(async () => {
        Simulate.click(required(container.querySelector('.clear-assignee-filter')));
    });
    expect(container.querySelector('[data-entry-id="unrelated"]')).not.toBeNull();
    expect(container.querySelector('.column-group')).toBeNull();
});

test('given group editing in details, saving a new group preserves goal-parent relationships and metrics', async () => {
    localStorage.setItem(
        'compass-preview-v1',
        JSON.stringify({
            items: [
                {
                    id: 'old-group',
                    type: 'group',
                    name: 'Old group',
                    description: '',
                    childIds: ['goal'],
                    assignees: []
                },
                {
                    id: 'new-group',
                    type: 'group',
                    name: 'New group',
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
        changeValue(required(container.querySelector('#goal-group')), 'new-group');
    });
    await act(async () => {
        Simulate.submit(required(container.querySelector('.details > form')));
    });
    const saved = savedGraph().items;
    expect(required(saved.find((entry) => entry.id === 'old-group')).childIds).toEqual([]);
    expect(required(saved.find((entry) => entry.id === 'new-group')).childIds).toEqual(['goal']);
    expect(required(saved.find((entry) => entry.id === 'parent')).childIds).toEqual(['goal']);
    expect(required(saved.find((entry) => entry.id === 'goal')).childIds).toEqual(['metric']);
});

test('given an assignee-matched metric, all parent goals and group ancestors remain visible without unrelated siblings', () => {
    const alice = { accountId: 'alice', displayName: 'Alice' };
    const items = [
        entryFixture({
            id: 'group',
            type: 'group',
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
        'group',
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
        entryFixture({ id: 'group', type: 'group', childIds: ['first', 'second'] }),
        entryFixture({ id: 'first', type: 'goal', childIds: [] }),
        entryFixture({ id: 'second', type: 'goal', childIds: [] })
    ];
    expect(moveListEntry(items, 'group/second', 'group/first', 'before')[0].childIds).toEqual([
        'second',
        'first'
    ]);
});

test('given a shared goal, moving one occurrence preserves its other parent and metrics', () => {
    const items = [
        entryFixture({ id: 'first', type: 'goal', childIds: ['shared'] }),
        entryFixture({ id: 'second', type: 'goal', childIds: ['shared'] }),
        entryFixture({ id: 'group', type: 'group', childIds: [] }),
        entryFixture({ id: 'shared', type: 'goal', childIds: ['metric'] }),
        entryFixture({ id: 'metric', type: 'metric', childIds: [] })
    ];
    const moved = moveListEntry(items, 'first/shared', 'group', 'inside');
    expect(required(moved.find((entry) => entry.id === 'first')).childIds).toEqual([]);
    expect(required(moved.find((entry) => entry.id === 'second')).childIds).toEqual(['shared']);
    expect(required(moved.find((entry) => entry.id === 'group')).childIds).toEqual(['shared']);
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

test('given a metric, dragging it into a group is rejected', () => {
    const items = [
        entryFixture({ id: 'goal', type: 'goal', childIds: ['metric'] }),
        entryFixture({ id: 'metric', type: 'metric', childIds: [] }),
        entryFixture({ id: 'group', type: 'group', childIds: [] })
    ];
    expect(() => moveListEntry(items, 'goal/metric', 'group', 'inside')).toThrow(/Groups contain/);
});

test('given root entries, dragging changes their saved list order', () => {
    const items = [
        entryFixture({ id: 'goal', type: 'goal', childIds: [] }),
        entryFixture({ id: 'group', type: 'group', childIds: [] })
    ];
    expect(moveListEntry(items, 'group', 'goal', 'before').map((entry) => entry.id)).toEqual([
        'group',
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

test('given a failed saved avatar, a fresh Jira image replaces the grey fallback', async () => {
    const user = {
        accountId: 'jira-refreshed-avatar',
        displayName: 'Alex Morgan',
        avatarUrl:
            'https://avatar-management--avatars.us-west-2.prod.public.atl-paas.net/initials/AM-5.png'
    };
    const currentAvatar =
        'https://avatar-management--avatars.us-west-2.prod.public.atl-paas.net/initials/AM-2.png';
    let resolveAvatar!: (url: string | null) => void;
    jest.spyOn(jiraUsers, 'loadAvatar').mockReturnValue(
        new Promise((resolve) => {
            resolveAvatar = resolve;
        })
    );
    await act(async () => {
        ReactDOM.render(<AssigneeChip user={user} />, container);
    });
    act(() => {
        Simulate.error(required(container.querySelector('img')));
    });
    expect(container.querySelector('img')).toBeNull();

    await act(async () => {
        resolveAvatar(currentAvatar);
    });

    expect(required(container.querySelector('img')).src).toBe(currentAvatar);
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
        labelIds: [],
        type: 'group',
        ...(entry.type === 'goal' ? { goalCategory: 'Delivery' as const } : {}),
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
                entryFixture({ id: 'platform', name: 'Platform', childIds: ['identity'] }),
                entryFixture({ id: 'identity', name: 'Identity' })
            ],
            updatedAt: null
        })
    );
    await act(async () => {
        ReactDOM.render(<App />, container);
    });
    act(() => {
        Simulate.click(required(container.querySelector('[aria-label="Open group Platform"]')));
    });
    act(() => {
        Simulate.click(required(container.querySelector('[aria-label="Delete group"]')));
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
            type: 'group',
            assignees: [],
            labelIds: []
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
                    id: 'group',
                    type: 'group',
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
        assignees: [{ accountId: 'preview-alex', displayName: 'Alex Morgan' }],
        labelIds: []
    });
    expect(required(saved.items.find((entry) => entry.id === 'goal')).childIds).toEqual([
        'created-entry'
    ]);
});

test('given groups and shared goals, the graph hides groups and keeps every goal parent and metric', () => {
    const items = [
        entryFixture({
            id: 'group',
            type: 'group',
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
            <ItemGraph items={items} selectedId="group" mode="tree" onSelect={() => {}} />,
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

test('given a goal moved between groups, its goal parents and metric relationships remain unchanged', () => {
    const items = [
        entryFixture({ id: 'first-group', type: 'group', childIds: ['shared'] }),
        entryFixture({ id: 'second-group', type: 'group', childIds: [] }),
        entryFixture({ id: 'first-goal', type: 'goal', childIds: ['shared'] }),
        entryFixture({ id: 'second-goal', type: 'goal', childIds: ['shared'] }),
        entryFixture({ id: 'shared', type: 'goal', childIds: ['metric'] }),
        entryFixture({ id: 'metric', type: 'metric', childIds: [] })
    ];
    const moved = moveGoalToGroup(items, 'shared', 'second-group');
    expect(moved.filter((entry) => entry.type === 'goal')).toEqual(
        items.filter((entry) => entry.type === 'goal')
    );
    expect(required(moved.find((entry) => entry.id === 'first-group')).childIds).toEqual([]);
    expect(required(moved.find((entry) => entry.id === 'second-group')).childIds).toEqual([
        'shared'
    ]);
});

test('given inline groups, shared branches and ungrouped roots remain visible in the hierarchy', () => {
    const items = [
        entryFixture({ id: 'group', type: 'group', childIds: ['first', 'second'] }),
        entryFixture({ id: 'first', type: 'goal', childIds: ['shared'] }),
        entryFixture({ id: 'second', type: 'goal', childIds: ['shared'] }),
        entryFixture({ id: 'shared', type: 'goal', childIds: ['metric'] }),
        entryFixture({ id: 'metric', type: 'metric', childIds: [] }),
        entryFixture({ id: 'ungrouped', type: 'goal', childIds: [] })
    ];
    expect(buildListRows(items, items).map((row) => row.entry.id)).toEqual([
        'group',
        'first',
        'shared',
        'metric',
        'second',
        'shared',
        'metric',
        'ungrouped'
    ]);
});

test('given an empty workspace, the list creates a goal without a group or parent', async () => {
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

test('given groups and nested goals, inline rows follow their parent with increasing indentation', () => {
    const items = [
        entryFixture({ id: 'metric', type: 'metric', childIds: [] }),
        entryFixture({ id: 'child', type: 'goal', childIds: ['metric'] }),
        entryFixture({ id: 'parent', type: 'goal', childIds: ['child'] }),
        entryFixture({ id: 'group', type: 'group', childIds: ['parent'] })
    ];
    expect(buildListRows(items, items).map(({ entry, depth }) => [entry.id, depth])).toEqual([
        ['group', 0],
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

test('given a collapsed group, descendants stay hidden until that branch is expanded', () => {
    const items = [
        entryFixture({ id: 'group', type: 'group', childIds: ['goal'] }),
        entryFixture({ id: 'goal', type: 'goal', childIds: [] })
    ];
    expect(buildListRows(items, items, new Set(['group'])).map((row) => row.entry.id)).toEqual([
        'group'
    ]);
});

test('given a matching metric, filtering retains its group and goal ancestors as context', () => {
    const items = [
        entryFixture({ id: 'group', type: 'group', childIds: ['goal'] }),
        entryFixture({ id: 'goal', type: 'goal', childIds: ['metric'] }),
        entryFixture({ id: 'metric', type: 'metric', childIds: [] })
    ];
    expect(buildListRows(items, [items[2]]).map((row) => row.entry.id)).toEqual([
        'group',
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
