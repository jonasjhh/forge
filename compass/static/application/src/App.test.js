import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { Network } from 'vis-network/standalone';
import App from './App';
import ItemGraph from './ItemGraph';
import { buildListRows, moveGoalToFolder } from './entries';

jest.mock('vis-network/standalone', () => ({
    Network: jest.fn()
}));

let container;

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
    Network.mockImplementation((element, data) => ({
        on: jest.fn(),
        once: jest.fn(),
        destroy: jest.fn(),
        selectNodes: jest.fn((selectedIds) => {
            if (selectedIds.some((id) => !data.nodes.some((node) => node.id === id))) {
                throw new Error('Selected node is missing from the graph.');
            }
        })
    }));
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
        Simulate.click(container.querySelector('[aria-label="Open folder Platform"]'));
    });
    act(() => {
        Simulate.click(container.querySelector('[aria-label="Delete folder"]'));
    });

    await act(async () => {
        Simulate.submit(container.querySelector('dialog form'));
    });

    expect(container.querySelector('dialog')).toBeNull();
    expect(container.querySelectorAll('.entry-row')).toHaveLength(1);
    expect(container.querySelector('.goal-name-text').textContent).toBe('Identity');
    expect(JSON.parse(localStorage.getItem('compass-preview-v1')).items).toEqual([
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
    const items = [{ id: 'identity', name: 'Identity', description: '', childIds: [] }];

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

    expect(Network.mock.results[0].value.selectNodes).toHaveBeenCalledWith([], false);
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
        Simulate.click(container.querySelector('[aria-label="Open goal Customer experience"]'));
    });
    act(() => {
        Simulate.click(
            [...container.querySelectorAll('button')].find(
                (button) => button.textContent.trim() === 'Add metric'
            )
        );
    });
    act(() => {
        Simulate.change(container.querySelector('#new-name'), {
            target: { value: 'Response time' }
        });
        Simulate.change(container.querySelector('#new-assignees'), { target: { value: 'Alex' } });
    });
    act(() => {
        Simulate.change(container.querySelector('#new-metric-currentValue'), {
            target: { value: '8' }
        });
    });
    act(() => {
        Simulate.change(container.querySelector('#new-metric-targetValue'), {
            target: { value: '2' }
        });
    });
    act(() => {
        Simulate.change(container.querySelector('#new-metric-unit'), {
            target: { value: 'hours' }
        });
    });
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
    });
    act(() => {
        Simulate.click(
            [...container.querySelectorAll('.user-results button')].find(
                (button) => button.textContent === 'Alex Morgan'
            )
        );
    });

    await act(async () => {
        Simulate.submit(container.querySelector('dialog form'));
    });

    const saved = JSON.parse(localStorage.getItem('compass-preview-v1'));
    expect(saved.items.find((entry) => entry.id === 'created-entry')).toEqual({
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
    expect(saved.items.find((entry) => entry.id === 'goal').childIds).toEqual(['created-entry']);
});

test('given folders and shared goals, the graph hides folders and keeps every goal parent and metric', () => {
    const items = [
        { id: 'folder', type: 'folder', name: 'Strategy', childIds: ['first', 'second'] },
        { id: 'first', type: 'goal', name: 'First', childIds: ['shared'] },
        { id: 'second', type: 'goal', name: 'Second', childIds: ['shared'] },
        { id: 'shared', type: 'goal', name: 'Shared', childIds: ['metric'] },
        { id: 'metric', type: 'metric', name: 'Metric', childIds: [] }
    ];
    act(() => {
        ReactDOM.render(
            <ItemGraph items={items} selectedId="folder" mode="tree" onSelect={() => {}} />,
            container
        );
    });
    const data = Network.mock.calls[0][1];
    expect(data.nodes.map((node) => node.id)).toEqual(['first', 'second', 'shared', 'metric']);
    expect(data.edges).toEqual([
        { from: 'first', to: 'shared' },
        { from: 'second', to: 'shared' },
        { from: 'shared', to: 'metric' }
    ]);
    expect(Network.mock.results[0].value.selectNodes).toHaveBeenCalledWith([], false);
});

test('given a goal moved between folders, its goal parents and metric relationships remain unchanged', () => {
    const items = [
        { id: 'first-folder', type: 'folder', childIds: ['shared'] },
        { id: 'second-folder', type: 'folder', childIds: [] },
        { id: 'first-goal', type: 'goal', childIds: ['shared'] },
        { id: 'second-goal', type: 'goal', childIds: ['shared'] },
        { id: 'shared', type: 'goal', childIds: ['metric'] },
        { id: 'metric', type: 'metric', childIds: [] }
    ];
    const moved = moveGoalToFolder(items, 'shared', 'second-folder');
    expect(moved.filter((entry) => entry.type === 'goal')).toEqual(
        items.filter((entry) => entry.type === 'goal')
    );
    expect(moved.find((entry) => entry.id === 'first-folder').childIds).toEqual([]);
    expect(moved.find((entry) => entry.id === 'second-folder').childIds).toEqual(['shared']);
});

test('given inline folders, shared branches and ungrouped roots remain visible in the hierarchy', () => {
    const items = [
        { id: 'folder', type: 'folder', childIds: ['first', 'second'] },
        { id: 'first', type: 'goal', childIds: ['shared'] },
        { id: 'second', type: 'goal', childIds: ['shared'] },
        { id: 'shared', type: 'goal', childIds: ['metric'] },
        { id: 'metric', type: 'metric', childIds: [] },
        { id: 'ungrouped', type: 'goal', childIds: [] }
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
            [...container.querySelectorAll('button')].find(
                (button) => button.textContent.trim() === 'New goal'
            )
        );
    });
    act(() => {
        Simulate.change(container.querySelector('#new-name'), {
            target: { value: 'Independent goal' }
        });
    });
    await act(async () => {
        Simulate.submit(container.querySelector('dialog form'));
    });
    expect(container.querySelector('[aria-label="Open goal Independent goal"]')).not.toBeNull();
    expect(JSON.parse(localStorage.getItem('compass-preview-v1')).items[0].type).toBe('goal');
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
        Simulate.click(container.querySelector('[aria-label="Open goal Shared"]'));
    });
    act(() => {
        Simulate.change(container.querySelector('#parent-goal'), { target: { value: 'second' } });
    });
    await act(async () => {
        Simulate.submit(container.querySelector('#parent-goal').closest('form'));
    });
    expect(container.querySelector('[aria-label="Unlink parent First"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Unlink parent Second"]')).not.toBeNull();
    await act(async () => {
        Simulate.click(container.querySelector('[aria-label="Unlink parent First"]'));
    });
    const saved = JSON.parse(localStorage.getItem('compass-preview-v1')).items;
    expect(saved.find((entry) => entry.id === 'first').childIds).toEqual([]);
    expect(saved.find((entry) => entry.id === 'second').childIds).toEqual(['shared']);
    expect(saved.find((entry) => entry.id === 'shared').childIds).toEqual(['metric']);
});

test('given folders and nested goals, inline rows follow their parent with increasing indentation', () => {
    const items = [
        { id: 'metric', type: 'metric', childIds: [] },
        { id: 'child', type: 'goal', childIds: ['metric'] },
        { id: 'parent', type: 'goal', childIds: ['child'] },
        { id: 'folder', type: 'folder', childIds: ['parent'] }
    ];
    expect(buildListRows(items, items).map(({ entry, depth }) => [entry.id, depth])).toEqual([
        ['folder', 0],
        ['parent', 1],
        ['child', 2],
        ['metric', 3]
    ]);
});

test('given a shared sub-goal, it appears beneath each parent using the same saved entry', () => {
    const shared = { id: 'shared', type: 'goal', childIds: [] };
    const items = [
        { id: 'first', type: 'goal', childIds: ['shared'] },
        { id: 'second', type: 'goal', childIds: ['shared'] },
        shared
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
        { id: 'folder', type: 'folder', childIds: ['goal'] },
        { id: 'goal', type: 'goal', childIds: [] }
    ];
    expect(buildListRows(items, items, new Set(['folder'])).map((row) => row.entry.id)).toEqual([
        'folder'
    ]);
});

test('given a matching metric, filtering retains its folder and goal ancestors as context', () => {
    const items = [
        { id: 'folder', type: 'folder', childIds: ['goal'] },
        { id: 'goal', type: 'goal', childIds: ['metric'] },
        { id: 'metric', type: 'metric', childIds: [] }
    ];
    expect(buildListRows(items, [items[2]]).map((row) => row.entry.id)).toEqual([
        'folder',
        'goal',
        'metric'
    ]);
});

test('given a row limit, hierarchy projection stops without expanding all shared branches', () => {
    const items = [
        { id: 'first', type: 'goal', childIds: ['shared'] },
        { id: 'second', type: 'goal', childIds: ['shared'] },
        { id: 'shared', type: 'goal', childIds: [] }
    ];
    expect(buildListRows(items, items, new Set(), 2).map((row) => row.entry.id)).toEqual([
        'first',
        'shared'
    ]);
});
