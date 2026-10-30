import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import { DataSet, Network } from 'vis-network/standalone';
import App from '../../../app/App';
import ItemGraph from '../components/ItemGraph';
import GoalList from '../components/GoalList';
import AssigneeChip from '../../../components/assignees/AssigneeChip';
import { getUserAvatar } from '../../../services/jiraUsers';
import * as jiraUsers from '../../../services/jiraUsers';
import type { SavedGraph, WorkspaceEntry } from '../../../types/workspace';
import {
    buildListRows,
    connectedEntries,
    linkListEntry,
    matchesAssignees,
    moveGoalToGroup,
    moveListEntry
} from '../model/entries';

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

test('given a collapsed toolbar, active filters and actions remain available and the preference survives reopening', async () => {
    const items = [
        entryFixture({ id: 'matching', type: 'goal', name: 'Matching goal' }),
        entryFixture({ id: 'other', type: 'goal', name: 'Other goal' })
    ];
    localStorage.setItem(
        'compass-preview-v1',
        JSON.stringify({ items, labels: [], updatedAt: null })
    );
    await act(async () => {
        ReactDOM.render(<App />, container);
    });
    const toolbar = required(container.querySelector<HTMLElement>('#workspace-toolbar'));
    expect(toolbar.hidden).toBe(false);
    expect(container.querySelector('.list-heading')).toBeNull();
    act(() =>
        changeValue(
            required(container.querySelector('[aria-label="Search workspace"]')),
            'Matching'
        )
    );
    act(() => Simulate.click(required(container.querySelector('[aria-label="Collapse toolbar"]'))));
    expect(toolbar.hidden).toBe(true);
    expect(localStorage.getItem('compass-toolbar-expanded')).toBe('false');
    expect(container.querySelector('[data-entry-id="matching"]')).not.toBeNull();
    expect(container.querySelector('[data-entry-id="other"]')).toBeNull();
    expect(
        container.querySelector('[aria-label="Expand toolbar"]')?.getAttribute('aria-expanded')
    ).toBe('false');
    expect(container.querySelector('.app-header [aria-label="Refresh workspace"]')).not.toBeNull();
    act(() =>
        Simulate.click(required(container.querySelector('[aria-label="Show 1 active filters"]')))
    );
    expect(toolbar.hidden).toBe(false);
    expect(
        required(container.querySelector<HTMLInputElement>('[aria-label="Search workspace"]')).value
    ).toBe('Matching');
    act(() => Simulate.click(required(container.querySelector('[aria-label="Clear filters"]'))));
    expect(container.querySelector('[data-entry-id="other"]')).not.toBeNull();
    act(() => Simulate.click(required(container.querySelector('[aria-label="Collapse toolbar"]'))));
    await act(async () => {
        ReactDOM.unmountComponentAtNode(container);
        ReactDOM.render(<App />, container);
    });
    expect(required(container.querySelector<HTMLElement>('#workspace-toolbar')).hidden).toBe(true);
    act(() => {
        Simulate.click(
            required(
                [...container.querySelectorAll<HTMLButtonElement>('.header-actions button')].find(
                    (button) => button.textContent?.trim() === 'New goal'
                )
            )
        );
    });
    expect(container.querySelector('dialog')).not.toBeNull();
    expect(savedGraph().items).toEqual(items);
});

test('given a graph, collapsing the toolbar preserves its network and selection', async () => {
    const items = [entryFixture({ id: 'goal', type: 'goal' })];
    localStorage.setItem(
        'compass-preview-v1',
        JSON.stringify({ items, labels: [], updatedAt: null })
    );
    await act(async () => {
        ReactDOM.render(<App />, container);
    });
    act(() => Simulate.click(required(container.querySelector('[aria-label="Graph"]'))));
    const instance: NetworkMock = mockNetwork.mock.results[0].value;
    act(() => {
        required(instance.on.mock.calls.find(([eventName]) => eventName === 'selectNode'))[1]({
            nodes: ['goal']
        });
    });
    act(() => Simulate.click(required(container.querySelector('[aria-label="Collapse toolbar"]'))));
    expect(mockNetwork).toHaveBeenCalledTimes(1);
    expect(instance.destroy).not.toHaveBeenCalled();
    expect(instance.selectNodes).toHaveBeenLastCalledWith(['goal'], false);
    expect(container.querySelector('.details')).not.toBeNull();
});

test.each([499, 500])(
    'given %i workspace entries, creation buttons follow the 500-entry limit',
    async (entryCount) => {
        const items = Array.from({ length: entryCount }, (_, index) =>
            entryFixture({ id: `goal-${index}`, type: 'goal' })
        );
        localStorage.setItem(
            'compass-preview-v1',
            JSON.stringify({ items, labels: [], updatedAt: null })
        );
        await act(async () => {
            ReactDOM.render(<App />, container);
        });
        const button = (label: string) =>
            required(
                [...container.querySelectorAll<HTMLButtonElement>('button')].find(
                    (candidate) => candidate.textContent?.trim() === label
                )
            );
        expect(button('New goal').disabled).toBe(entryCount >= 500);
        expect(button('New group').disabled).toBe(entryCount >= 500);
    }
);

test('given the New goal dialog, fields follow the requested order and parent selection remains available', async () => {
    localStorage.setItem(
        'compass-preview-v1',
        JSON.stringify({
            items: [entryFixture({ id: 'group', name: 'Group' })],
            labels: [{ id: 'team', name: 'Team', color: '#0c66e4' }],
            updatedAt: null
        })
    );
    await act(async () => {
        ReactDOM.render(<App />, container);
    });
    act(() =>
        Simulate.click(required(container.querySelector('[aria-label="Add goal under Group"]')))
    );
    const dialog = required(container.querySelector('dialog'));
    const fields = dialog.querySelectorAll(
        '#new-type, #new-goal-category, #new-name, #new-description, #new-assignees, summary[aria-label="Labels"], #new-parent'
    );
    expect([...fields].map((field) => field.id || field.getAttribute('aria-label'))).toEqual([
        'new-type',
        'new-goal-category',
        'new-name',
        'new-description',
        'new-assignees',
        'Labels',
        'new-parent'
    ]);
    expect(required(dialog.querySelector<HTMLSelectElement>('#new-parent')).value).toBe('group');
});

test('given a goal category, creating and changing it updates the list label and icon', async () => {
    const longGoalName = 'A'.repeat(120);
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
        changeValue(required(container.querySelector('#new-name')), longGoalName);
        changeValue(required(container.querySelector('#new-goal-category')), 'Capability');
    });
    await act(async () => {
        Simulate.submit(required(container.querySelector('dialog form')));
    });

    const created = required(savedGraph().items.find((item) => item.id === 'created-entry'));
    expect(created.goalCategory).toBe('Capability');
    const createdRow = required(container.querySelector('[data-entry-id="created-entry"]'));
    expect(createdRow.querySelector('.goal-row-meta')).toBeNull();
    expect(createdRow.querySelector('.entry-icon-capability')?.getAttribute('aria-label')).toBe(
        'Capability'
    );
    expect(createdRow.querySelector('.entry-icon-capability')).not.toBeNull();

    act(() => {
        Simulate.click(
            required(container.querySelector(`[aria-label="Open goal ${longGoalName}"]`))
        );
        changeValue(required(container.querySelector('#goal-category')), 'Decision');
    });
    await act(async () => {
        Simulate.submit(required(container.querySelector('.details form')));
    });

    const updated = required(savedGraph().items.find((item) => item.id === 'created-entry'));
    expect(updated.goalCategory).toBe('Decision');
    const updatedRow = required(container.querySelector('[data-entry-id="created-entry"]'));
    expect(updatedRow.querySelector('.goal-row-meta')).toBeNull();
    expect(updatedRow.querySelector('.entry-icon-decision')?.getAttribute('aria-label')).toBe(
        'Decision'
    );
    expect(updatedRow.querySelector('.entry-icon-decision')).not.toBeNull();

    const typeFilter = required(
        container.querySelector<HTMLDetailsElement>('.list-filters .checkbox-dropdown')
    );
    expect(typeFilter.querySelector('input[value="Decision"]')).not.toBeNull();
    expect(typeFilter.querySelector('input[value="Capability"]')).not.toBeNull();
    expect(typeFilter.querySelector('input[value="Delivery"]')).not.toBeNull();
});

test('given an open edit sidebar, closing it clears selection and allows reopening', async () => {
    localStorage.setItem(
        'compass-preview-v1',
        JSON.stringify({
            items: [entryFixture({ id: 'goal', type: 'goal', name: 'Original goal' })],
            updatedAt: null
        })
    );
    await act(async () => {
        ReactDOM.render(<App />, container);
    });
    act(() => {
        Simulate.click(required(container.querySelector('[aria-label="Open goal Original goal"]')));
    });
    const closeButton = required(
        container.querySelector<HTMLButtonElement>('.details [aria-label="Close sidebar"]')
    );
    expect(closeButton.title).toBe('Close sidebar');
    act(() => Simulate.click(closeButton));
    expect(container.querySelector('.details')).toBeNull();
    expect(container.querySelector('.workspace.has-selection')).toBeNull();
    expect(
        container
            .querySelector('[aria-label="Open goal Original goal"]')
            ?.getAttribute('aria-pressed')
    ).toBe('false');
    act(() => {
        Simulate.click(required(container.querySelector('[aria-label="Open goal Original goal"]')));
    });
    expect(container.querySelector('.details')).not.toBeNull();
    expect(savedGraph().items[0].name).toBe('Original goal');
});

test.each([0, 1])(
    'given sidebar save button %s, it saves the same edit form',
    async (buttonIndex) => {
        localStorage.setItem(
            'compass-preview-v1',
            JSON.stringify({
                items: [entryFixture({ id: 'goal', type: 'goal', name: 'Original goal' })],
                updatedAt: null
            })
        );
        await act(async () => {
            ReactDOM.render(<App />, container);
        });
        act(() => {
            Simulate.click(
                required(container.querySelector('[aria-label="Open goal Original goal"]'))
            );
        });
        const sidebar = required(container.querySelector('.details'));
        const buttons = sidebar.querySelectorAll<HTMLButtonElement>('.save-button');
        expect(buttons).toHaveLength(2);
        expect(sidebar.children[1].contains(buttons[0])).toBe(true);
        expect(sidebar.lastElementChild?.contains(buttons[1])).toBe(true);
        expect(buttons[0].form?.id).toBe('entry-edit-form');
        expect(buttons[1].form).toBe(buttons[0].form);
        expect(buttons[0].disabled).toBe(true);
        expect(buttons[1].disabled).toBe(true);
        act(() => changeValue(required(container.querySelector('#item-name')), ''));
        expect(buttons[0].disabled).toBe(true);
        expect(buttons[1].disabled).toBe(true);
        act(() => changeValue(required(container.querySelector('#item-name')), 'Updated goal'));
        expect(buttons[0].disabled).toBe(false);
        expect(buttons[1].disabled).toBe(false);
        await act(async () => {
            buttons[buttonIndex].click();
        });
        expect(savedGraph().items[0].name).toBe('Updated goal');
        expect(buttons[0].disabled).toBe(true);
        expect(buttons[1].disabled).toBe(true);
    }
);

test('given an edit sidebar, its divider resizes with pointer and keyboard within limits', async () => {
    localStorage.setItem(
        'compass-preview-v1',
        JSON.stringify({
            items: [entryFixture({ id: 'goal', type: 'goal', name: 'Goal' })],
            updatedAt: null
        })
    );
    await act(async () => {
        ReactDOM.render(<App />, container);
    });
    expect(container.querySelector('.sidebar-resizer')).toBeNull();
    act(() => {
        Simulate.click(required(container.querySelector('[aria-label="Open goal Goal"]')));
    });
    const handle = required(container.querySelector<HTMLButtonElement>('.sidebar-resizer'));
    const workspace = required(container.querySelector<HTMLDivElement>('.workspace'));
    jest.spyOn(workspace, 'getBoundingClientRect').mockReturnValue({ width: 1200 } as DOMRect);
    Object.defineProperty(handle, 'setPointerCapture', { value: jest.fn() });
    act(() => Simulate.keyDown(handle, { key: 'ArrowLeft' }));
    expect(handle.getAttribute('aria-valuenow')).toBe('340');
    act(() => Simulate.pointerDown(handle, { button: 0, clientX: 800 }));
    act(() => Simulate.pointerMove(handle, { clientX: 700 }));
    expect(workspace.style.getPropertyValue('--sidebar-width')).toBe('440px');
    act(() => Simulate.pointerMove(handle, { clientX: 0 }));
    expect(handle.getAttribute('aria-valuenow')).toBe('600');
    act(() => Simulate.pointerMove(handle, { clientX: 2000 }));
    expect(handle.getAttribute('aria-valuenow')).toBe('280');
    act(() => Simulate.pointerUp(handle));
    act(() => Simulate.pointerMove(handle, { clientX: 0 }));
    expect(handle.getAttribute('aria-valuenow')).toBe('280');
    act(() => Simulate.keyDown(handle, { key: 'ArrowRight' }));
    expect(handle.getAttribute('aria-valuenow')).toBe('280');
});

test.each(['group', 'goal'] as const)(
    'given a %s row, its plus shortcut creates a goal beneath that entry',
    async (type) => {
        localStorage.setItem(
            'compass-preview-v1',
            JSON.stringify({
                items: [entryFixture({ id: 'parent', type, name: 'Parent' })],
                updatedAt: null
            })
        );
        await act(async () => {
            ReactDOM.render(<App />, container);
        });
        act(() => {
            required(container.querySelector('[aria-label="Add goal under Parent"]')).dispatchEvent(
                new MouseEvent('click', { bubbles: true })
            );
        });
        expect(container.querySelector('.details')).toBeNull();
        expect(required(container.querySelector<HTMLSelectElement>('#new-type')).value).toBe(
            'goal'
        );
        expect(required(container.querySelector<HTMLSelectElement>('#new-parent')).value).toBe(
            'parent'
        );
        act(() => changeValue(required(container.querySelector('#new-name')), 'New child'));
        await act(async () => {
            Simulate.submit(required(container.querySelector('dialog form')));
        });
        expect(
            required(savedGraph().items.find((entry) => entry.id === 'parent')).childIds
        ).toEqual(['created-entry']);
        expect(
            required(savedGraph().items.find((entry) => entry.id === 'created-entry')).type
        ).toBe('goal');
        expect(container.querySelector('[data-path="parent/created-entry"]')).not.toBeNull();
    }
);

test.each([
    'invalid JSON',
    '{"items": [], "labels": {}}',
    JSON.stringify({
        items: [
            {
                id: 'broken',
                type: 'goal',
                name: 'Broken',
                description: '',
                childIds: ['missing'],
                assignees: [],
                labelIds: []
            }
        ],
        labels: []
    })
])('given invalid import data, existing workspace data is not changed', async (contents) => {
    const original = {
        items: [entryFixture({ id: 'old', name: 'Old' })],
        labels: [],
        updatedAt: null
    };
    localStorage.setItem('compass-preview-v1', JSON.stringify(original));
    await act(async () => {
        ReactDOM.render(<App />, container);
    });
    const write = jest.spyOn(Storage.prototype, 'setItem');
    await selectImportFile(contents);
    expect(container.querySelector('[role="alert"]')).not.toBeNull();
    expect(container.querySelector('dialog')).toBeNull();
    expect(savedGraph()).toEqual(original);
    expect(write).not.toHaveBeenCalled();
});

test('given a valid import, cancellation preserves data and confirmation replaces the entire workspace', async () => {
    const original = {
        items: [entryFixture({ id: 'old', name: 'Old' })],
        labels: [],
        updatedAt: null
    };
    const imported = {
        items: [
            entryFixture({ id: 'first', type: 'goal', name: 'First', childIds: ['shared'] }),
            entryFixture({ id: 'second', type: 'goal', name: 'Second', childIds: ['shared'] }),
            entryFixture({
                id: 'shared',
                type: 'goal',
                name: 'Shared',
                childIds: ['metric'],
                labelIds: ['team'],
                assignees: [{ accountId: 'alice', displayName: 'Alice' }]
            }),
            entryFixture({
                id: 'metric',
                type: 'metric',
                name: 'Metric',
                currentValue: 3,
                targetValue: 10,
                unit: 'days'
            })
        ],
        labels: [{ id: 'team', name: 'Team', color: '#0c66e4' }]
    };
    localStorage.setItem('compass-preview-v1', JSON.stringify(original));
    await act(async () => {
        ReactDOM.render(<App />, container);
    });
    act(() => {
        Simulate.click(required(container.querySelector('[aria-label="Open group Old"]')));
        changeValue(required(container.querySelector('[aria-label="Search workspace"]')), 'Old');
    });
    const write = jest.spyOn(Storage.prototype, 'setItem');
    await selectImportFile(JSON.stringify(imported));
    expect(container.querySelector('#import-title')?.textContent).toBe('Replace workspace?');
    expect(write).not.toHaveBeenCalled();
    act(() =>
        Simulate.click(required(container.querySelector('[aria-label="Close import dialog"]')))
    );
    expect(savedGraph()).toEqual(original);
    await selectImportFile(JSON.stringify(imported));
    await act(async () => {
        Simulate.submit(required(container.querySelector('dialog form')));
    });
    expect(write).toHaveBeenCalledTimes(1);
    expect(savedGraph()).toEqual({ ...imported, updatedAt: expect.any(String) });
    expect(container.querySelector('dialog')).toBeNull();
    expect(container.querySelector('.details')).toBeNull();
    expect(
        required(container.querySelector<HTMLInputElement>('[aria-label="Search workspace"]')).value
    ).toBe('');
    expect(container.querySelectorAll('[data-entry-id="shared"]')).toHaveLength(2);
    await act(async () => {
        ReactDOM.unmountComponentAtNode(container);
        ReactDOM.render(<App />, container);
    });
    expect(container.querySelectorAll('[data-entry-id="shared"]')).toHaveLength(2);
    expect(container.querySelector('[data-entry-id="old"]')).toBeNull();
});

test('given a failed import save, the existing data remains and the confirmation can be retried', async () => {
    const original = {
        items: [entryFixture({ id: 'old', name: 'Old' })],
        labels: [],
        updatedAt: null
    };
    localStorage.setItem('compass-preview-v1', JSON.stringify(original));
    await act(async () => {
        ReactDOM.render(<App />, container);
    });
    await selectImportFile('{"items":[],"labels":[]}');
    const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage unavailable');
    });
    await act(async () => {
        Simulate.submit(required(container.querySelector('dialog form')));
    });
    expect(savedGraph()).toEqual(original);
    expect(container.querySelector('dialog [role="alert"]')).not.toBeNull();
    write.mockRestore();
    await act(async () => {
        Simulate.submit(required(container.querySelector('dialog form')));
    });
    expect(savedGraph().items).toEqual([]);
    expect(container.querySelector('dialog')).toBeNull();
});

test('given filtered workspace data, exporting downloads all entries and labels without writing', async () => {
    const original = {
        items: [
            entryFixture({ id: 'visible', name: 'Visible' }),
            entryFixture({ id: 'hidden', name: 'Hidden' })
        ],
        labels: [{ id: 'team', name: 'Team', color: '#0c66e4' }],
        updatedAt: null
    };
    localStorage.setItem('compass-preview-v1', JSON.stringify(original));
    await act(async () => {
        ReactDOM.render(<App />, container);
    });
    act(() =>
        changeValue(required(container.querySelector('[aria-label="Search workspace"]')), 'Visible')
    );
    const write = jest.spyOn(Storage.prototype, 'setItem');
    const createUrl = jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:workspace');
    let downloadName = '';
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement
    ) {
        downloadName = this.download;
    });
    act(() =>
        Simulate.click(
            required(
                [...container.querySelectorAll<HTMLButtonElement>('.toolbar-actions button')].find(
                    (button) => button.textContent?.trim() === 'Export'
                )
            )
        )
    );
    const blob = createUrl.mock.calls[0][0] as Blob;
    const contents = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(blob);
    });
    expect(blob.type).toBe('application/json');
    expect(JSON.parse(contents)).toEqual({ items: original.items, labels: original.labels });
    expect(downloadName).toMatch(/^compass-workspace-\d{4}-\d{2}-\d{2}\.json$/);
    expect(write).not.toHaveBeenCalled();
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

test('given many long labels, the list shows two chips and an overflow count without changing assignments', async () => {
    const labels = Array.from({ length: 5 }, (_, index) => ({
        id: `label-${index}`,
        name: `Long label ${index} with a detailed description`,
        color: '#0c66e4'
    }));
    const goal = entryFixture({
        id: 'goal',
        type: 'goal',
        name: 'Labelled goal',
        labelIds: labels.map((label) => label.id)
    });
    localStorage.setItem(
        'compass-preview-v1',
        JSON.stringify({ items: [goal], labels, updatedAt: null })
    );
    await act(async () => {
        ReactDOM.render(<App />, container);
    });
    const chips = container.querySelectorAll<HTMLElement>('.table-labels .workspace-label-chip');
    expect([...chips].map((chip) => chip.textContent)).toEqual(
        labels.slice(0, 2).map((label) => label.name)
    );
    expect(chips[0].title).toBe(labels[0].name);
    const overflow = required(container.querySelector<HTMLElement>('.table-label-overflow'));
    expect(overflow.textContent).toBe('+3');
    expect(overflow.title).toBe(
        labels
            .slice(2)
            .map((label) => label.name)
            .join('\n')
    );
    expect(overflow.tabIndex).toBe(0);
    expect(overflow.getAttribute('aria-label')).toContain(labels[4].name);
    expect(savedGraph().items[0].labelIds).toEqual(goal.labelIds);
    act(() => {
        Simulate.click(required(container.querySelector('[aria-label="Open goal Labelled goal"]')));
    });
    expect(container.querySelector('.details')).not.toBeNull();
    expect(savedGraph().items[0].labelIds).toHaveLength(5);
});

test('given an item editor, only existing labels can be assigned', async () => {
    localStorage.setItem(
        'compass-preview-v1',
        JSON.stringify({
            items: [entryFixture({ id: 'goal', type: 'goal', name: 'Platform plan' })],
            labels: [{ id: 'architecture', name: 'Architecture', color: '#aabbcc' }],
            updatedAt: null
        })
    );
    await act(async () => {
        ReactDOM.render(<App />, container);
    });
    act(() => {
        Simulate.click(required(container.querySelector('[aria-label="Open goal Platform plan"]')));
    });
    expect(
        [...container.querySelectorAll<HTMLButtonElement>('.details button')].some(
            (button) => button.textContent?.trim() === 'Add label'
        )
    ).toBe(false);
    act(() => {
        const detailsLabels = required(
            container.querySelector<HTMLElement>(
                '.details .checkbox-dropdown-option input[value="architecture"]'
            )
        );
        (detailsLabels as HTMLInputElement).checked = true;
        Simulate.change(detailsLabels);
    });
    await act(async () => {
        Simulate.submit(required(container.querySelector('.details form')));
    });

    expect(savedGraph().labels).toEqual([
        { id: 'architecture', name: 'Architecture', color: '#aabbcc' }
    ]);
    expect(required(savedGraph().items[0]).labelIds).toEqual(['architecture']);
});

test('given list search and type filters, graph and tree remain independent', async () => {
    const items = [
        entryFixture({ id: 'group', childIds: ['parent'] }),
        entryFixture({
            id: 'parent',
            type: 'goal',
            goalCategory: 'Decision',
            name: 'Parent goal',
            childIds: ['child']
        }),
        entryFixture({
            id: 'child',
            type: 'goal',
            goalCategory: 'Capability',
            name: 'Child goal',
            childIds: ['metric']
        }),
        entryFixture({
            id: 'metric',
            type: 'metric',
            name: 'Build count',
            labelIds: ['platform']
        }),
        entryFixture({ id: 'other', type: 'goal', name: 'Unrelated' })
    ];
    localStorage.setItem(
        'compass-preview-v1',
        JSON.stringify({
            items,
            labels: [{ id: 'platform', name: 'Platform', color: '#0c66e4' }],
            updatedAt: null
        })
    );
    await act(async () => {
        ReactDOM.render(<App />, container);
    });

    const search = required(
        container.querySelector<HTMLInputElement>('[aria-label="Search workspace"]')
    );
    const typeFilter = required(
        container.querySelector<HTMLDetailsElement>('.workspace-filters .checkbox-dropdown')
    );
    const setType = (value: string, checked: boolean) =>
        act(() => {
            const checkbox = required(
                typeFilter.querySelector<HTMLInputElement>(`input[value="${value}"]`)
            );
            checkbox.checked = checked;
            Simulate.change(checkbox);
        });
    const latestNodeIds = () =>
        mockNetwork.mock.calls[mockNetwork.mock.calls.length - 1][1].nodes.map((node) => node.id);

    act(() => changeValue(search, 'Child goal'));
    expect(
        [...container.querySelectorAll<HTMLElement>('.entry-row')].map((row) => row.dataset.entryId)
    ).toEqual(['group', 'parent', 'child']);

    setType('all', false);
    setType('Capability', true);
    expect(
        [...container.querySelectorAll<HTMLElement>('.entry-row')].map((row) => row.dataset.entryId)
    ).toEqual(['group', 'parent', 'child']);

    act(() => {
        Simulate.click(
            required(
                [...container.querySelectorAll<HTMLButtonElement>('.view-switch button')].find(
                    (button) => button.textContent?.trim() === 'Tree'
                )
            )
        );
    });
    expect(latestNodeIds()).toEqual(['parent', 'child', 'metric', 'other']);
    expect(container.querySelector('.workspace-filters')).toBeNull();

    act(() => {
        Simulate.click(
            required(
                [...container.querySelectorAll<HTMLButtonElement>('.view-switch button')].find(
                    (button) => button.textContent?.trim() === 'Tree'
                )
            )
        );
    });
    expect(latestNodeIds()).toEqual(['parent', 'child', 'metric', 'other']);
    expect(container.querySelector('.workspace-filters')).toBeNull();

    act(() => {
        Simulate.click(
            required(
                [...container.querySelectorAll<HTMLButtonElement>('.view-switch button')].find(
                    (button) => button.textContent?.trim() === 'List'
                )
            )
        );
    });
    expect(
        [...container.querySelectorAll<HTMLElement>('.entry-row')].map((row) => row.dataset.entryId)
    ).toEqual(['group', 'parent', 'child']);
    setType('all', true);
    act(() => changeValue(search, 'Platform'));
    expect(
        [...container.querySelectorAll<HTMLElement>('.entry-row')].map((row) => row.dataset.entryId)
    ).toEqual(['group', 'parent', 'child', 'metric']);
});

test('given the Cards tab, deliveries show only existing fields and related workspace data', async () => {
    const items = [
        entryFixture({
            id: 'objective',
            type: 'goal',
            name: 'Objective',
            childIds: ['delivery', 'sibling'],
            goalCategory: 'Decision'
        }),
        entryFixture({
            id: 'delivery',
            type: 'goal',
            name: 'Improve digital process',
            description: 'Users complete the process without duplicate registration.',
            childIds: ['metric', 'sub-decision', 'sub-capability', 'sub-delivery'],
            assignees: [{ accountId: 'owner-1', displayName: 'Alex Morgan' }],
            labelIds: ['program'],
            goalCategory: 'Delivery'
        }),
        entryFixture({
            id: 'metric',
            type: 'metric',
            name: 'Completion rate',
            currentValue: 20,
            targetValue: 70,
            unit: '%'
        }),
        entryFixture({
            id: 'sub-decision',
            type: 'goal',
            name: 'Approve exception handling',
            goalCategory: 'Decision'
        }),
        entryFixture({
            id: 'sub-capability',
            type: 'goal',
            name: 'Validate structured input',
            goalCategory: 'Capability'
        }),
        entryFixture({
            id: 'sub-delivery',
            type: 'goal',
            name: 'Automate intake',
            goalCategory: 'Delivery'
        }),
        entryFixture({
            id: 'sibling',
            type: 'goal',
            name: 'Decision: update workflow',
            goalCategory: 'Decision'
        })
    ];
    const labels = [{ id: 'program', name: 'Program OKR', color: '#0c66e4' }];
    localStorage.setItem('compass-preview-v1', JSON.stringify({ items, labels, updatedAt: null }));
    await act(async () => {
        ReactDOM.render(<App />, container);
    });
    act(() => Simulate.click(required(container.querySelector('[aria-label="Cards"]'))));

    const deliveryList = required(container.querySelector('[aria-label="Deliveries"]'));
    expect(deliveryList.querySelectorAll('.delivery-list-item')).toHaveLength(2);
    expect(deliveryList.textContent).not.toContain('Decision: update workflow');
    expect(container.querySelector('.workspace-filters')).toBeNull();
    expect(container.querySelector('.details')).toBeNull();
    expect(container.querySelector('.connection-count')?.textContent).toBe('2 deliveries');
    expect(container.querySelector('.delivery-card-header h2')?.textContent).toBe(
        'Improve digital process'
    );
    expect(container.querySelector('.delivery-card-header p')?.textContent).toBe(
        'Users complete the process without duplicate registration.'
    );
    expect(container.querySelector('.delivery-card')?.textContent).toContain('Alex Morgan');
    expect(container.querySelector('.delivery-card')?.textContent).toContain('Program OKR');
    expect(container.querySelector('.delivery-card')?.textContent).toContain('Objective');
    expect(container.querySelector('.delivery-card')?.textContent).toContain('Automate intake');
    expect(
        [...container.querySelectorAll<HTMLElement>('.delivery-subgoal-group')].map(
            (group) => group.dataset.subgoalCategory
        )
    ).toEqual(['Decision', 'Capability', 'Delivery']);
    expect(container.querySelector('.delivery-card')?.textContent).toContain(
        'Approve exception handling'
    );
    expect(container.querySelector('.delivery-card')?.textContent).toContain(
        'Validate structured input'
    );
    expect(container.querySelector('.delivery-card')?.textContent).toContain('20 / 70 %');
    expect(container.querySelector('.delivery-card')?.textContent).not.toContain('Status');
    expect(container.querySelector('.delivery-card')?.textContent).not.toContain('Risk');

    act(() =>
        Simulate.click(
            required(
                [...container.querySelectorAll<HTMLButtonElement>('.delivery-list-item')].find(
                    (button) => button.textContent === 'Automate intake'
                )
            )
        )
    );
    expect(container.querySelector('.delivery-card-header h2')?.textContent).toBe(
        'Automate intake'
    );
    expect(savedGraph().items).toEqual(items);
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

test('given an existing goal, linking it beneath another parent preserves all existing data', () => {
    const items = [
        entryFixture({ id: 'old', type: 'goal', childIds: ['shared'] }),
        entryFixture({ id: 'new', type: 'goal' }),
        entryFixture({ id: 'shared', type: 'goal', childIds: ['metric'] }),
        entryFixture({ id: 'metric', type: 'metric' })
    ];
    const linked = linkListEntry(items, 'shared', 'new');
    expect(linked[0]).toEqual(items[0]);
    expect(linked[1].childIds).toEqual(['shared']);
    expect(linked.slice(2)).toEqual(items.slice(2));
    expect(items[1].childIds).toEqual([]);
});

test.each([
    ['goal', 'goal'],
    ['goal', 'child'],
    ['child', 'goal'],
    ['metric', 'group'],
    ['goal', 'metric'],
    ['missing', 'goal']
])('given an invalid link from %s to %s, no connection is created', (sourceId, parentId) => {
    const items = [
        entryFixture({ id: 'group', childIds: ['goal'] }),
        entryFixture({ id: 'goal', type: 'goal', childIds: ['child'] }),
        entryFixture({ id: 'child', type: 'goal', childIds: ['metric'] }),
        entryFixture({ id: 'metric', type: 'metric' })
    ];
    expect(() => linkListEntry(items, sourceId, parentId)).toThrow(/connection/);
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

test.each([
    { selector: '[data-path="parent"]', selected: ['parent'], deleted: [] },
    { selector: '[data-path="parent"] .column-labels', selected: ['parent'], deleted: [] },
    { selector: '[data-path="parent"] .column-assignees span', selected: ['parent'], deleted: [] },
    { selector: '[data-path="parent"] .goal-name svg', selected: ['parent'], deleted: [] },
    { selector: '[data-path="parent"] .branch-toggle svg', selected: [], deleted: [] },
    { selector: '[data-path="parent"] .drag-handle svg', selected: [], deleted: [] },
    {
        selector: '[data-path="parent"] [aria-label="Delete goal parent"] svg',
        selected: [],
        deleted: ['parent']
    },
    { selector: '[data-path="parent"] .link-drop-target svg', selected: [], deleted: [] },
    {
        selector: '[data-path="parent/child"] .parent-goal-count',
        selected: ['child'],
        deleted: []
    }
])(
    'given a row click on $selector, only the intended action runs',
    ({ selector, selected, deleted }) => {
        const items = [
            entryFixture({ id: 'parent', type: 'goal', childIds: ['child'] }),
            entryFixture({ id: 'child', type: 'goal' })
        ];
        const onSelect = jest.fn();
        const onDelete = jest.fn();
        act(() => {
            ReactDOM.render(
                <GoalList
                    items={items}
                    labels={[]}
                    entries={items}
                    selectedId={null}
                    busy={false}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onCreateGoal={() => {}}
                    onLink={async () => true}
                    onRearrange={async () => true}
                />,
                container
            );
        });
        act(() => {
            required(container.querySelector(selector)).dispatchEvent(
                new MouseEvent('click', { bubbles: true })
            );
        });
        expect(onSelect.mock.calls.flat()).toEqual(selected);
        expect(onDelete.mock.calls.flat()).toEqual(deleted);
    }
);

test.each([
    { sourceHandle: '.link-drop-target', destination: '.drop-inside', preservesParent: true },
    { sourceHandle: '.drag-handle', destination: '.link-drop-target', preservesParent: true },
    { sourceHandle: '.drag-handle', destination: '.drop-inside', preservesParent: false }
])(
    'given a drag from $sourceHandle to $destination, its save uses the correct link or move operation',
    async ({ sourceHandle, destination, preservesParent }) => {
        const items = [
            entryFixture({ id: 'old', type: 'goal', childIds: ['source'] }),
            entryFixture({ id: 'source', type: 'goal', childIds: ['metric'] }),
            entryFixture({ id: 'metric', type: 'metric' }),
            entryFixture({ id: 'target', type: 'goal', childIds: ['target-child'] }),
            entryFixture({ id: 'target-child', type: 'goal' }),
            entryFixture({ id: 'unrelated', type: 'goal', childIds: ['hidden-child'] }),
            entryFixture({ id: 'hidden-child', type: 'goal' })
        ];
        localStorage.setItem(
            'compass-preview-v1',
            JSON.stringify({ items, labels: [], updatedAt: null })
        );
        jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
            this: HTMLElement
        ) {
            const row = this.closest<HTMLElement>('.entry-row');
            const rowTop = row
                ? [
                      'old',
                      'source',
                      'metric',
                      'target',
                      'target-child',
                      'unrelated',
                      'hidden-child'
                  ].indexOf(row.dataset.entryId!) * 80
                : 0;
            let top = rowTop;
            let left = 0;
            let width = 600;
            let height = 80;
            if (this.classList.contains('drop-before')) height = 20;
            if (this.classList.contains('drop-inside')) {
                top += 20;
                height = 40;
            }
            if (this.classList.contains('drop-after')) {
                top += 60;
                height = 20;
            }
            if (this.classList.contains('link-drop-target')) {
                left = 24;
                top += 8;
                width = 24;
                height = 24;
            }
            return {
                x: left,
                y: top,
                left,
                top,
                width,
                height,
                right: left + width,
                bottom: top + height
            } as DOMRect;
        });
        await act(async () => {
            ReactDOM.render(<App />, container);
        });
        act(() =>
            Simulate.click(required(container.querySelector('[aria-label="Collapse source"]')))
        );
        act(() =>
            Simulate.click(required(container.querySelector('[aria-label="Collapse target"]')))
        );
        act(() =>
            Simulate.click(required(container.querySelector('[aria-label="Collapse unrelated"]')))
        );
        const table = required(container.querySelector('.goal-table'));
        const source = required(
            container.querySelector<HTMLElement>(`[data-entry-id="source"] ${sourceHandle}`)
        );
        const target = required(
            container.querySelector<HTMLElement>(`[data-entry-id="target"] ${destination}`)
        );
        const sourceBounds = source.getBoundingClientRect();
        const targetBounds = target.getBoundingClientRect();
        function pointer(
            targetElement: EventTarget,
            type: string,
            clientX: number,
            clientY: number
        ): void {
            const event = new MouseEvent(type, {
                bubbles: true,
                button: 0,
                buttons: type === 'pointerup' ? 0 : 1,
                clientX,
                clientY
            });
            Object.defineProperty(event, 'isPrimary', { value: true });
            targetElement.dispatchEvent(event);
        }
        act(() => pointer(source, 'pointerdown', sourceBounds.left + 5, sourceBounds.top + 10));
        act(() => pointer(document, 'pointermove', sourceBounds.left + 15, sourceBounds.top + 10));
        act(() =>
            pointer(
                document,
                'pointermove',
                targetBounds.left + targetBounds.width / 2,
                targetBounds.top + targetBounds.height / 2
            )
        );
        await act(async () =>
            pointer(
                document,
                'pointerup',
                targetBounds.left + targetBounds.width / 2,
                targetBounds.top + targetBounds.height / 2
            )
        );
        const saved = savedGraph().items;
        expect(required(saved.find((entry) => entry.id === 'target')).childIds).toEqual([
            'target-child',
            'source'
        ]);
        expect(required(saved.find((entry) => entry.id === 'old')).childIds).toEqual(
            preservesParent ? ['source'] : []
        );
        expect(required(saved.find((entry) => entry.id === 'source')).childIds).toEqual(['metric']);
        expect(container.querySelector('.goal-table')).toBe(table);
        expect(container.querySelector('[aria-label="Expand unrelated"]')).not.toBeNull();
        expect(container.querySelector('[data-path="unrelated/hidden-child"]')).toBeNull();
        expect(container.querySelector('[aria-label="Collapse target"]')).not.toBeNull();
        expect(container.querySelector('[data-path="target/target-child"]')).not.toBeNull();
        expect(container.querySelector('[data-path="old/source/metric"]')).toBeNull();
        expect(Boolean(container.querySelector('[data-path="target/source/metric"]'))).toBe(
            preservesParent
        );
    }
);

test.each([0, 1, 12])(
    'given %s parent goals, the list shows a compact count with names in its tooltip',
    (parentCount) => {
        const parents = Array.from({ length: parentCount }, (_, index) =>
            entryFixture({
                id: `parent-${index}`,
                type: 'goal',
                name: `Parent ${index + 1}`,
                childIds: ['shared']
            })
        );
        const items = [
            entryFixture({ id: 'group', name: 'Group', childIds: ['shared'] }),
            ...parents,
            entryFixture({ id: 'shared', type: 'goal', name: 'Shared' })
        ];
        act(() => {
            ReactDOM.render(
                <GoalList
                    items={items}
                    labels={[]}
                    entries={items}
                    selectedId={null}
                    busy={false}
                    onSelect={() => {}}
                    onDelete={() => {}}
                    onCreateGoal={() => {}}
                    onLink={async () => true}
                    onRearrange={async () => true}
                />,
                container
            );
        });
        const cell = required(
            container.querySelector('[data-path="group/shared"] .column-parents')
        );
        const count = required(cell.querySelector<HTMLElement>('.parent-goal-count'));
        expect(cell.textContent?.trim()).toBe(String(parentCount));
        expect(count.title).toBe(
            parentCount ? parents.map((parent) => parent.name).join('\n') : 'No parent goals'
        );
        expect(count.getAttribute('aria-label')).toContain(
            `${parentCount} ${parentCount === 1 ? 'parent goal' : 'parent goals'}`
        );
        expect(count.tabIndex).toBe(0);
        expect(container.querySelector('[data-path="group"] .column-parents')?.textContent).toBe(
            '-'
        );
        expect(cell.querySelector('button')).toBeNull();
    }
);

test('given compact list rows, type icons replace subtitles and metric values remain inline', async () => {
    const items = [
        entryFixture({
            id: 'group',
            name: 'Group name',
            childIds: ['delivery', 'capability', 'decision']
        }),
        entryFixture({ id: 'delivery', type: 'goal', name: 'Delivery goal', childIds: ['metric'] }),
        entryFixture({
            id: 'capability',
            type: 'goal',
            name: 'Capability goal',
            goalCategory: 'Capability'
        }),
        entryFixture({
            id: 'decision',
            type: 'goal',
            name: 'Decision goal',
            goalCategory: 'Decision'
        }),
        entryFixture({
            id: 'metric',
            type: 'metric',
            name: 'Completion',
            currentValue: 25,
            targetValue: 100,
            unit: '%'
        })
    ];
    localStorage.setItem(
        'compass-preview-v1',
        JSON.stringify({ items, labels: [], updatedAt: null })
    );
    await act(async () => {
        ReactDOM.render(<App />, container);
    });
    expect(container.querySelector('.goal-row-meta')).toBeNull();
    expect(container.querySelector('[data-entry-id="group"] .goal-name')?.textContent).toBe(
        'GroupGroup name'
    );
    expect(
        container
            .querySelector('[data-entry-id="delivery"] .entry-icon-delivery')
            ?.getAttribute('aria-label')
    ).toBe('Delivery');
    expect(
        container.querySelector('[data-entry-id="metric"] .metric-progress')?.textContent
    ).toContain('25 / 100 %');
    expect(container.querySelector<HTMLTableColElement>('col.column-parents')?.style.width).toBe(
        '5%'
    );
    expect(container.querySelector<HTMLTableColElement>('col.column-metrics')?.style.width).toBe(
        '5%'
    );
    expect(container.querySelector('[aria-label="Parent goals"]')?.getAttribute('title')).toBe(
        'Parent goals'
    );
    expect(container.querySelector('[aria-label="Metrics"]')?.getAttribute('title')).toBe(
        'Metrics'
    );
});

test('given a table column resizer, arrow keys adjust the adjacent column widths', () => {
    const items = [entryFixture({ id: 'group', type: 'group' })];
    act(() => {
        ReactDOM.render(
            <GoalList
                items={items}
                labels={[]}
                entries={items}
                selectedId={null}
                busy={false}
                onSelect={() => {}}
                onDelete={() => {}}
                onCreateGoal={() => {}}
                onLink={async () => true}
                onRearrange={async () => true}
            />,
            container
        );
    });

    const nameResizer = required(
        container.querySelector<HTMLButtonElement>('[aria-label="Resize Name column"]')
    );
    const columns = required(
        container.querySelectorAll<HTMLTableColElement>('#workspace-entry-table col')
    );
    expect(nameResizer.getAttribute('aria-valuenow')).toBe('48');
    act(() => Simulate.keyDown(nameResizer, { key: 'ArrowRight' }));
    expect(nameResizer.getAttribute('aria-valuenow')).toBe('50');
    expect(columns[0].style.width).toBe('50%');
    expect(columns[1].style.width).toBe('19%');
});

test('given a table column resizer, pointer dragging adjusts adjacent column widths', () => {
    const items = [entryFixture({ id: 'group', type: 'group' })];
    act(() => {
        ReactDOM.render(
            <GoalList
                items={items}
                labels={[]}
                entries={items}
                selectedId={null}
                busy={false}
                onSelect={() => {}}
                onDelete={() => {}}
                onCreateGoal={() => {}}
                onLink={async () => true}
                onRearrange={async () => true}
            />,
            container
        );
    });

    const table = required(container.querySelector<HTMLTableElement>('#workspace-entry-table'));
    jest.spyOn(table, 'getBoundingClientRect').mockReturnValue({ width: 1000 } as DOMRect);
    const nameResizer = required(
        container.querySelector<HTMLButtonElement>('[aria-label="Resize Name column"]')
    );
    Object.defineProperty(nameResizer, 'setPointerCapture', { value: jest.fn() });

    act(() => Simulate.pointerDown(nameResizer, { clientX: 100 }));
    act(() => Simulate.pointerMove(nameResizer, { clientX: 130 }));

    const columns = required(
        container.querySelectorAll<HTMLTableColElement>('#workspace-entry-table col')
    );
    expect(nameResizer.getAttribute('aria-valuenow')).toBe('51');
    expect(columns[0].style.width).toBe('51%');
    expect(columns[1].style.width).toBe('18%');
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
    ...jest.requireActual('vis-network/standalone/umd/vis-network.js'),
    Network: jest.fn()
}));

interface GraphMockData {
    nodes: Array<{
        id: string;
        label: string;
        title: string;
        color: { background: string; border: string };
        hidden?: boolean;
        opacity?: number;
    }>;
    edges: Array<{
        id?: string;
        from: string;
        to: string;
        hidden?: boolean;
        color?: { opacity?: number };
    }>;
}
interface NetworkMock {
    on: jest.Mock;
    once: jest.Mock;
    destroy: jest.Mock;
    selectNodes: jest.Mock;
    stopSimulation: jest.Mock;
    setOptions: jest.Mock;
    fit: jest.Mock;
    getScale: jest.Mock;
    moveTo: jest.Mock;
    DOMtoCanvas: jest.Mock;
}
const mockNetwork = Network as unknown as jest.Mock<
    NetworkMock,
    [
        HTMLElement,
        {
            nodes: DataSet<GraphMockData['nodes'][number]>;
            edges: DataSet<GraphMockData['edges'][number]>;
        },
        {
            edges: { arrows: { from: { enabled: boolean }; to: { enabled: boolean } } };
            nodes: {
                font: {
                    size: number;
                    align: string;
                    multi: string;
                    bold: { size: number; mod: string };
                };
                chosen: { label: boolean };
            };
        }?
    ]
>;

function graphSnapshot(index = mockNetwork.mock.calls.length - 1): GraphMockData {
    const data = mockNetwork.mock.calls[index][1];
    return {
        nodes: data.nodes.get().filter((node) => !node.hidden && node.opacity !== 0.15),
        edges: data.edges
            .get()
            .filter((edge) => !edge.hidden && edge.color?.opacity !== 0.1)
            .map(({ from, to }) => ({ from, to }))
    };
}

function required<Value>(value: Value | null | undefined): Value {
    if (value === null || value === undefined)
        throw new Error('Expected fixture or DOM element was not found.');
    return value;
}

async function selectImportFile(contents: string): Promise<void> {
    const file = new File([contents], 'workspace.json', { type: 'application/json' });
    Object.defineProperty(file, 'text', { value: async () => contents });
    const input = required(
        container.querySelector<HTMLInputElement>('[aria-label="Import workspace JSON file"]')
    );
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    await act(async () => {
        Simulate.change(input);
    });
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
    Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: () => 'blob:workspace'
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: () => {}
    });
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
        (element: HTMLElement, data: { nodes: DataSet<{ id: string }> }) => ({
            on: jest.fn(),
            once: jest.fn(),
            destroy: jest.fn(),
            stopSimulation: jest.fn(),
            setOptions: jest.fn(),
            fit: jest.fn(),
            getScale: jest.fn(() => 1),
            moveTo: jest.fn(),
            DOMtoCanvas: jest.fn(() => ({ x: 20, y: 30 })),
            selectNodes: jest.fn((selectedIds: string[]) => {
                if (selectedIds.some((id) => !data.nodes.get(id))) {
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

test('given an unselected row, its trash action confirms deletion and preserves its child', async () => {
    localStorage.setItem(
        'compass-preview-v1',
        JSON.stringify({
            items: [
                entryFixture({ id: 'group', name: 'Group', childIds: ['goal'] }),
                entryFixture({ id: 'goal', type: 'goal', name: 'Goal', childIds: ['metric'] }),
                entryFixture({ id: 'metric', type: 'metric', name: 'Metric' })
            ],
            updatedAt: null
        })
    );
    await act(async () => {
        ReactDOM.render(<App />, container);
    });
    expect(container.querySelectorAll('.entry-row [aria-label^="Delete "]')).toHaveLength(3);
    expect(container.querySelector('[aria-label="Add goal under Metric"]')).toBeNull();
    act(() => {
        Simulate.click(required(container.querySelector('[aria-label="Open group Group"]')));
    });
    act(() => {
        Simulate.click(required(container.querySelector('[aria-label="Delete goal Goal"]')));
    });
    expect(container.querySelector('dialog strong')?.textContent).toBe('Goal');
    expect(savedGraph().items).toHaveLength(3);
    act(() => {
        Simulate.click(required(container.querySelector('[aria-label="Close dialog"]')));
    });
    expect(savedGraph().items).toHaveLength(3);
    act(() => {
        Simulate.click(required(container.querySelector('[aria-label="Delete goal Goal"]')));
    });
    await act(async () => {
        Simulate.submit(required(container.querySelector('dialog form')));
    });
    expect(savedGraph().items.map((entry) => entry.id)).toEqual(['group', 'metric']);
    expect(savedGraph().items[0].childIds).toEqual([]);
    expect(container.querySelector('[aria-label="Delete goal Goal"]')).toBeNull();
    expect(container.querySelector('[aria-label="Delete metric Metric"]')).not.toBeNull();
});

test.each(['row', 'sidebar'])(
    'given a shared goal, the %s delete action removes only its intended scope',
    async (source) => {
        const sharedGoal = entryFixture({
            id: 'shared',
            type: 'goal',
            name: 'Shared',
            childIds: ['metric']
        });
        const metric = entryFixture({ id: 'metric', type: 'metric', name: 'Metric' });
        localStorage.setItem(
            'compass-preview-v1',
            JSON.stringify({
                items: [
                    entryFixture({ id: 'first', type: 'goal', childIds: ['shared'] }),
                    entryFixture({ id: 'second', type: 'goal', childIds: ['shared'] }),
                    sharedGoal,
                    metric
                ],
                updatedAt: null
            })
        );
        await act(async () => {
            ReactDOM.render(<App />, container);
        });
        act(() => {
            if (source === 'row') {
                Simulate.click(
                    required(
                        container.querySelector(
                            '[data-path="second/shared"] [aria-label="Delete goal Shared"]'
                        )
                    )
                );
            } else {
                Simulate.click(
                    required(container.querySelector('[aria-label="Open goal Shared"]'))
                );
            }
        });
        if (source === 'sidebar') {
            act(() => {
                Simulate.click(
                    required(container.querySelector('.details [aria-label="Delete goal"]'))
                );
            });
        }
        expect(container.querySelector('#dialog-title')?.textContent).toBe(
            source === 'row' ? 'Remove connection?' : 'Delete goal?'
        );
        expect(savedGraph().items).toHaveLength(4);
        await act(async () => {
            Simulate.submit(required(container.querySelector('dialog form')));
        });
        const saved = savedGraph().items;
        expect(required(saved.find((entry) => entry.id === 'second')).childIds).toEqual([]);
        expect(required(saved.find((entry) => entry.id === 'first')).childIds).toEqual(
            source === 'row' ? ['shared'] : []
        );
        expect(saved.find((entry) => entry.id === 'shared')).toEqual(
            source === 'row' ? sharedGoal : undefined
        );
        expect(saved.find((entry) => entry.id === 'metric')).toEqual(metric);
        expect(container.querySelector('[data-path="second/shared"]')).toBeNull();
        expect(Boolean(container.querySelector('[data-path="first/shared"]'))).toBe(
            source === 'row'
        );
    }
);

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
                labels={[]}
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

test('given shared goals, focus follows ancestors and descendants without including neighboring branches', () => {
    const items = [
        entryFixture({ id: 'group', childIds: ['first', 'unrelated'] }),
        entryFixture({ id: 'first', type: 'goal', childIds: ['shared', 'sibling'] }),
        entryFixture({ id: 'second', type: 'goal', childIds: ['shared'] }),
        entryFixture({ id: 'shared', type: 'goal', childIds: ['metric'] }),
        entryFixture({ id: 'metric', type: 'metric' }),
        entryFixture({ id: 'sibling', type: 'goal' }),
        entryFixture({ id: 'unrelated', type: 'goal' })
    ];
    expect(connectedEntries(items, 'metric').map((entry) => entry.id)).toEqual([
        'first',
        'second',
        'shared',
        'metric'
    ]);
    expect(connectedEntries(items, 'first').map((entry) => entry.id)).toEqual([
        'first',
        'shared',
        'metric',
        'sibling'
    ]);
    expect(connectedEntries(items, 'shared').map((entry) => entry.id)).toEqual([
        'first',
        'second',
        'shared',
        'metric'
    ]);
    expect(connectedEntries(items, 'unrelated').map((entry) => entry.id)).toEqual(['unrelated']);
    expect(connectedEntries(items, 'missing')).toEqual(items);
    expect(connectedEntries(items, 'group')).toEqual(items);
});

test.each(['Tree', 'Graph'])(
    'given shared dependencies in %s, focusing a goal dims other branches in the existing dataset',
    async (view) => {
        const items = [
            entryFixture({ id: 'first', type: 'goal', childIds: ['child', 'shared'] }),
            entryFixture({ id: 'child', type: 'goal', childIds: ['metric'] }),
            entryFixture({ id: 'metric', type: 'metric' }),
            entryFixture({ id: 'shared', type: 'goal' }),
            entryFixture({ id: 'other', type: 'goal', childIds: ['shared', 'other-child'] }),
            entryFixture({ id: 'other-child', type: 'goal' })
        ];
        localStorage.setItem(
            'compass-preview-v1',
            JSON.stringify({ items, labels: [], updatedAt: null })
        );
        await act(async () => {
            ReactDOM.render(<App />, container);
        });
        act(() => {
            Simulate.click(
                required(
                    [...container.querySelectorAll<HTMLButtonElement>('.view-switch button')].find(
                        (button) => button.textContent?.trim() === view
                    )
                )
            );
        });
        const instance: NetworkMock = mockNetwork.mock.results[0].value;
        const data = mockNetwork.mock.calls[0][1];
        const removeNodes = jest.spyOn(data.nodes, 'remove');
        const removeEdges = jest.spyOn(data.edges, 'remove');
        const select = required(
            instance.on.mock.calls.find(([eventName]) => eventName === 'selectNode')
        )[1];
        act(() => select({ nodes: ['first'] }));
        expect(graphSnapshot().nodes.map((node) => node.id)).toEqual([
            'first',
            'child',
            'metric',
            'shared'
        ]);
        expect(graphSnapshot().edges).toEqual([
            { from: 'first', to: 'child' },
            { from: 'first', to: 'shared' },
            { from: 'child', to: 'metric' }
        ]);
        expect(data.nodes.get('other')).toMatchObject({ hidden: false, opacity: 0.15 });
        expect(data.edges.get('other:shared')).toMatchObject({
            hidden: false,
            color: { opacity: 0.1 }
        });
        expect(data.nodes.length).toBe(6);
        expect(removeNodes).not.toHaveBeenCalled();
        expect(removeEdges).not.toHaveBeenCalled();
        expect(instance.fit).not.toHaveBeenCalled();
        expect(instance.moveTo).not.toHaveBeenCalled();
        expect(instance.destroy).not.toHaveBeenCalled();
        expect(mockNetwork).toHaveBeenCalledTimes(1);
        act(() => {
            Simulate.click(required(container.querySelector('[aria-label="Close sidebar"]')));
        });
        expect(graphSnapshot().nodes.map((node) => node.id)).toEqual([
            'first',
            'child',
            'metric',
            'shared'
        ]);
        expect(mockNetwork).toHaveBeenCalledTimes(1);
        expect(savedGraph().items).toEqual(items);
    }
);

test.each(['Tree', 'Graph'])(
    'given a clicked %s node, focus updates visibility without rebuilding the network',
    async (view) => {
        const items = [
            entryFixture({ id: 'group', childIds: ['parent', 'other'] }),
            entryFixture({ id: 'parent', type: 'goal', name: 'Parent', childIds: ['child'] }),
            entryFixture({ id: 'child', type: 'goal', name: 'Child', childIds: ['metric'] }),
            entryFixture({ id: 'metric', type: 'metric' }),
            entryFixture({ id: 'other', type: 'goal', name: 'Other' })
        ];
        localStorage.setItem(
            'compass-preview-v1',
            JSON.stringify({ items, labels: [], updatedAt: null })
        );
        await act(async () => {
            ReactDOM.render(<App />, container);
        });
        const viewButton = (name: string) =>
            required(
                [...container.querySelectorAll<HTMLButtonElement>('.view-switch button')].find(
                    (button) => button.textContent?.trim() === name
                )
            );
        const latestData = () => graphSnapshot();
        const graphEvent = (name: string, nodes: string[]) => {
            const instance: NetworkMock =
                mockNetwork.mock.results[mockNetwork.mock.results.length - 1].value;
            required(instance.on.mock.calls.find(([eventName]) => eventName === name))[1]({
                nodes
            });
        };
        act(() => Simulate.click(viewButton(view)));
        const networkCount = mockNetwork.mock.calls.length;
        const instance: NetworkMock = mockNetwork.mock.results[networkCount - 1].value;
        expect(latestData().nodes.map((node) => node.id)).toEqual([
            'parent',
            'child',
            'metric',
            'other'
        ]);
        act(() => graphEvent('selectNode', ['child']));
        expect(mockNetwork).toHaveBeenCalledTimes(networkCount);
        expect(instance.destroy).not.toHaveBeenCalled();
        expect(instance.stopSimulation).toHaveBeenCalled();
        expect(latestData().nodes.map((node) => node.id)).toEqual(['parent', 'child', 'metric']);
        expect(latestData().edges).toEqual([
            { from: 'parent', to: 'child' },
            { from: 'child', to: 'metric' }
        ]);
        expect(container.querySelector('.connection-count')?.textContent).toBe(
            '3 items · 2 relationships'
        );
        expect(container.querySelector('#item-name')).not.toBeNull();
        act(() => graphEvent('selectNode', ['metric']));
        expect(mockNetwork).toHaveBeenCalledTimes(networkCount);
        expect(latestData().nodes.map((node) => node.id)).toEqual(['parent', 'child', 'metric']);
        act(() =>
            Simulate.click(
                required(container.querySelector(`[aria-label="Show full ${view.toLowerCase()}"]`))
            )
        );
        expect(latestData().nodes.map((node) => node.id)).toEqual([
            'parent',
            'child',
            'metric',
            'other'
        ]);
        act(() => graphEvent('selectNode', ['other']));
        expect(latestData().nodes.map((node) => node.id)).toEqual(['other']);
        act(() => graphEvent('click', []));
        expect(latestData().nodes.map((node) => node.id)).toEqual([
            'parent',
            'child',
            'metric',
            'other'
        ]);
        expect(savedGraph().items).toEqual(items);
        expect(mockNetwork).toHaveBeenCalledTimes(networkCount);
        act(() => graphEvent('selectNode', ['child']));
        expect(latestData().nodes.map((node) => node.id)).toEqual(['parent', 'child', 'metric']);
        const refreshedItems = items.map((item) =>
            item.id === 'other' ? { ...item, name: 'Updated elsewhere' } : item
        );
        localStorage.setItem(
            'compass-preview-v1',
            JSON.stringify({
                items: refreshedItems,
                labels: [],
                updatedAt: null
            })
        );
        await act(async () => {
            Simulate.click(required(container.querySelector('[aria-label="Refresh workspace"]')));
        });
        expect(latestData().nodes.map((node) => node.id)).toEqual([
            'parent',
            'child',
            'metric',
            'other'
        ]);
        expect(required(latestData().nodes.find((node) => node.id === 'other')).label).toContain(
            'Updated elsewhere'
        );
        expect(container.querySelector('.details')).toBeNull();
        expect(
            container.querySelector(`[aria-label="Show full ${view.toLowerCase()}"]`)
        ).toBeNull();
        expect(container.querySelector('.connection-count')?.textContent).toBe(
            '4 items · 2 relationships'
        );
    }
);

test('given a selected list row, list filters stay local and graph and tree keep independent focus', async () => {
    const items = [
        entryFixture({ id: 'group', name: 'Group', childIds: ['parent', 'other'] }),
        entryFixture({ id: 'parent', type: 'goal', name: 'Parent', childIds: ['child'] }),
        entryFixture({ id: 'child', type: 'goal', name: 'Child', childIds: ['metric'] }),
        entryFixture({ id: 'metric', type: 'metric', name: 'Metric' }),
        entryFixture({ id: 'other', type: 'goal', name: 'Other' })
    ];
    localStorage.setItem(
        'compass-preview-v1',
        JSON.stringify({ items, labels: [], updatedAt: null })
    );
    await act(async () => {
        ReactDOM.render(<App />, container);
    });
    act(() =>
        changeValue(required(container.querySelector('[aria-label="Search workspace"]')), 'Parent')
    );
    act(() => Simulate.click(required(container.querySelector('[aria-label="Open goal Parent"]'))));
    expect(
        [...container.querySelectorAll<HTMLElement>('.entry-row')].map((row) => row.dataset.entryId)
    ).toEqual(['group', 'parent']);
    expect(container.querySelector('.details')).not.toBeNull();
    act(() =>
        Simulate.click(
            required(
                [...container.querySelectorAll<HTMLButtonElement>('.view-switch button')].find(
                    (button) => button.textContent?.trim() === 'Graph'
                )
            )
        )
    );
    expect(graphSnapshot().nodes.map((node) => node.id)).toEqual([
        'parent',
        'child',
        'metric',
        'other'
    ]);
    expect(container.querySelector('.workspace-filters')).toBeNull();
    const graphInstance: NetworkMock = mockNetwork.mock.results.at(-1)!.value;
    act(() => {
        required(graphInstance.on.mock.calls.find(([eventName]) => eventName === 'selectNode'))[1]({
            nodes: ['other']
        });
    });
    expect(graphSnapshot().nodes.map((node) => node.id)).toEqual(['other']);
    act(() =>
        Simulate.click(
            required(
                [...container.querySelectorAll<HTMLButtonElement>('.view-switch button')].find(
                    (button) => button.textContent?.trim() === 'Tree'
                )
            )
        )
    );
    expect(graphSnapshot().nodes.map((node) => node.id)).toEqual([
        'parent',
        'child',
        'metric',
        'other'
    ]);
    expect(container.querySelector('.workspace-filters')).toBeNull();
    const treeInstance: NetworkMock = mockNetwork.mock.results.at(-1)!.value;
    act(() => {
        required(treeInstance.on.mock.calls.find(([eventName]) => eventName === 'selectNode'))[1]({
            nodes: ['parent']
        });
    });
    expect(graphSnapshot().nodes.map((node) => node.id)).toEqual(['parent', 'child', 'metric']);
    act(() =>
        Simulate.click(
            required(
                [...container.querySelectorAll<HTMLButtonElement>('.view-switch button')].find(
                    (button) => button.textContent?.trim() === 'Graph'
                )
            )
        )
    );
    expect(graphSnapshot().nodes.map((node) => node.id)).toEqual(['other']);
    act(() =>
        Simulate.click(
            required(
                [...container.querySelectorAll<HTMLButtonElement>('.view-switch button')].find(
                    (button) => button.textContent?.trim() === 'List'
                )
            )
        )
    );
    expect(
        [...container.querySelectorAll<HTMLElement>('.entry-row')].map((row) => row.dataset.entryId)
    ).toEqual(['group', 'parent']);
    expect(container.querySelector('.details')).not.toBeNull();
    expect(
        required(container.querySelector<HTMLInputElement>('[aria-label="Search workspace"]')).value
    ).toBe('Parent');
    act(() =>
        changeValue(required(container.querySelector('[aria-label="Search workspace"]')), '')
    );
    expect(
        [...container.querySelectorAll<HTMLElement>('.entry-row')].map((row) => row.dataset.entryId)
    ).toEqual(['group', 'parent', 'child', 'metric', 'other']);
    expect(savedGraph().items).toEqual(items);
});

test.each(['Graph', 'Tree'])(
    'given %s navigation, zoom uses smaller steps and keyboard control stays within the graph',
    async (view) => {
        localStorage.setItem(
            'compass-preview-v1',
            JSON.stringify({
                items: [entryFixture({ id: 'goal', type: 'goal' })],
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
                        (button) => button.textContent?.trim() === view
                    )
                )
            );
        });
        expect(mockNetwork.mock.calls[0][2]).toMatchObject({
            interaction: {
                zoomSpeed: 0.25,
                keyboard: {
                    enabled: true,
                    bindToWindow: false,
                    speed: { x: 5, y: 5, zoom: 0.02 }
                }
            }
        });
        expect(container.querySelector('.network-canvas')?.hasAttribute('tabindex')).toBe(false);
        const instance = mockNetwork.mock.results[0].value;
        act(() => Simulate.click(required(container.querySelector('[aria-label="Zoom in"]'))));
        expect(instance.moveTo).toHaveBeenLastCalledWith({
            scale: 1.1,
            animation: { duration: 180, easingFunction: 'easeInOutQuad' }
        });
        act(() => Simulate.click(required(container.querySelector('[aria-label="Zoom out"]'))));
        expect(instance.moveTo).toHaveBeenLastCalledWith({
            scale: 1 / 1.1,
            animation: { duration: 180, easingFunction: 'easeInOutQuad' }
        });
        act(() => Simulate.click(required(container.querySelector('[aria-label="Fit graph"]'))));
        expect(instance.fit).toHaveBeenLastCalledWith({
            animation: { duration: 300, easingFunction: 'easeInOutQuad' }
        });
    }
);

test.each(['graph', 'tree'] as const)(
    'given %s canvas resizing, the existing zoom and view center are restored',
    (mode) => {
        const schedule = jest.spyOn(window, 'requestAnimationFrame').mockReturnValue(123);
        act(() => {
            ReactDOM.render(
                <ItemGraph
                    items={[entryFixture({ id: 'goal', type: 'goal' })]}
                    labels={[]}
                    selectedId={null}
                    mode={mode}
                    onSelect={() => {}}
                />,
                container
            );
        });
        const instance: NetworkMock = mockNetwork.mock.results[0].value;
        act(() => {
            required(instance.on.mock.calls.find(([eventName]) => eventName === 'resize'))[1]({
                oldWidth: 1000,
                oldHeight: 600
            });
        });
        expect(instance.DOMtoCanvas).toHaveBeenCalledWith({ x: 500, y: 300 });
        expect(instance.moveTo).not.toHaveBeenCalled();
        act(() => schedule.mock.calls[0][0](0));
        expect(instance.moveTo).toHaveBeenCalledWith({
            scale: 1,
            position: { x: 20, y: 30 },
            animation: false
        });
        expect(mockNetwork).toHaveBeenCalledTimes(1);
        expect(instance.destroy).not.toHaveBeenCalled();
    }
);

test('given changed callbacks and selection, the graph keeps its network and invokes the current callback', () => {
    const items = [entryFixture({ id: 'goal', type: 'goal' })];
    const originalSelect = jest.fn();
    const currentSelect = jest.fn();
    act(() => {
        ReactDOM.render(
            <ItemGraph
                items={items}
                labels={[]}
                selectedId={null}
                mode="graph"
                onSelect={originalSelect}
            />,
            container
        );
    });
    const instance: NetworkMock = mockNetwork.mock.results[0].value;
    act(() => {
        ReactDOM.render(
            <ItemGraph
                items={[...items]}
                labels={[]}
                selectedId="goal"
                mode="graph"
                onSelect={currentSelect}
            />,
            container
        );
    });
    act(() =>
        required(instance.on.mock.calls.find(([eventName]) => eventName === 'selectNode'))[1]({
            nodes: ['goal']
        })
    );
    expect(mockNetwork).toHaveBeenCalledTimes(1);
    expect(instance.destroy).not.toHaveBeenCalled();
    expect(currentSelect).toHaveBeenCalledWith('goal');
    expect(originalSelect).not.toHaveBeenCalled();
});

test('given title text containing markup, the graph keeps it literal rather than formatting the title', () => {
    const items = [
        entryFixture({ id: 'goal', type: 'goal', name: 'A <b>literal</b> & *plain* title' })
    ];
    act(() => {
        ReactDOM.render(
            <ItemGraph
                items={items}
                labels={[]}
                selectedId={null}
                mode="graph"
                onSelect={() => {}}
            />,
            container
        );
    });
    expect(graphSnapshot().nodes[0].label).toBe(
        '<b>Delivery</b>\nA <\u200bb>literal<\u200b/b> & *plain* title'
    );
});

test('given updated entries, the existing graph updates labels and connections without rebuilding', () => {
    const initial = [
        entryFixture({ id: 'parent', type: 'goal', childIds: ['old'] }),
        entryFixture({ id: 'old', type: 'goal' })
    ];
    const updated = [
        { ...initial[0], name: 'Updated parent', childIds: ['new'] },
        entryFixture({ id: 'new', type: 'metric' })
    ];
    act(() => {
        ReactDOM.render(
            <ItemGraph
                items={initial}
                labels={[]}
                selectedId={null}
                mode="graph"
                onSelect={() => {}}
            />,
            container
        );
    });
    act(() => {
        ReactDOM.render(
            <ItemGraph
                items={updated}
                labels={[]}
                selectedId="parent"
                mode="graph"
                onSelect={() => {}}
            />,
            container
        );
    });
    expect(mockNetwork).toHaveBeenCalledTimes(1);
    expect(graphSnapshot().nodes.map((node) => node.id)).toEqual(['parent', 'new']);
    expect(graphSnapshot().nodes[0].label).toBe('<b>Delivery</b>\nUpdated parent');
    expect(graphSnapshot().edges).toEqual([{ from: 'parent', to: 'new' }]);
});

test.each(['graph', 'tree'] as const)(
    'given %s view, arrowheads point in the intended direction without changing connections',
    (mode) => {
        const items = [
            entryFixture({ id: 'parent', type: 'goal', childIds: ['child'] }),
            entryFixture({ id: 'child', type: 'goal' })
        ];
        act(() => {
            ReactDOM.render(
                <ItemGraph
                    items={items}
                    labels={[]}
                    selectedId={null}
                    mode={mode}
                    onSelect={() => {}}
                />,
                container
            );
        });
        const [containerElement, , options] = mockNetwork.mock.calls[0];
        expect(containerElement).toBe(container.querySelector('.network-canvas'));
        expect(graphSnapshot().edges).toEqual([{ from: 'parent', to: 'child' }]);
        expect(required(options).edges.arrows.from.enabled).toBe(true);
        expect(required(options).edges.arrows.to.enabled).toBe(false);
    }
);

test('given groups and shared goals, the tree uses category styling and preserves every relationship', () => {
    const items = [
        entryFixture({
            id: 'group',
            type: 'group',
            name: 'Strategy',
            childIds: ['first', 'second']
        }),
        entryFixture({
            id: 'first',
            type: 'goal',
            goalCategory: 'Decision',
            name: 'First',
            childIds: ['shared']
        }),
        entryFixture({
            id: 'second',
            type: 'goal',
            goalCategory: 'Capability',
            name: 'Second',
            childIds: ['shared']
        }),
        entryFixture({
            id: 'shared',
            type: 'goal',
            goalCategory: 'Delivery',
            name: 'Shared',
            description: 'Shared description',
            childIds: ['metric'],
            assignees: [{ accountId: 'alice', displayName: 'Alice' }],
            labelIds: ['platform']
        }),
        entryFixture({
            id: 'metric',
            type: 'metric',
            name: 'Metric',
            childIds: [],
            currentValue: 8,
            targetValue: 10,
            unit: 'days'
        })
    ];
    const labels = [{ id: 'platform', name: 'Platform', color: '#0c66e4' }];
    act(() => {
        ReactDOM.render(
            <ItemGraph
                items={items}
                labels={labels}
                selectedId="group"
                mode="tree"
                onSelect={() => {}}
            />,
            container
        );
    });
    const data: GraphMockData = graphSnapshot(0);
    const typography = required(mockNetwork.mock.calls[0][2]).nodes;
    expect(typography.font.align).toBe('left');
    expect(typography.font.multi).toBe('html');
    expect(typography.font.bold.size).toBeLessThan(typography.font.size);
    expect(typography.font.bold.mod).toBe('');
    expect(typography.chosen.label).toBe(false);
    expect(data.nodes.map((node) => node.id)).toEqual(['first', 'second', 'shared', 'metric']);
    expect(data.nodes[0].label).toBe('<b>Decision</b>\nFirst');
    expect(data.nodes[0].color).toEqual({ background: '#fff1ef', border: '#ae2a19' });
    expect(data.nodes[1].label).toBe('<b>Capability</b>\nSecond');
    expect(data.nodes[2].label).toBe('<b>Delivery · Sub-goal</b>\nShared\n<code># Platform</code>');
    expect(data.nodes[2].title).toContain('Assignees: Alice');
    expect(data.nodes[2].title).toContain('Labels: Platform');
    expect(data.nodes[2].title).toContain('Shared description');
    expect(data.nodes[3].label).toBe('<b>Metric</b>\nMetric\n<code>8 / 10 days</code>');
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

test('given nested rows, hierarchy guides follow siblings and stop at branch ends after collapsing', () => {
    const items = [
        entryFixture({ id: 'group', name: 'Group', childIds: ['first', 'second'] }),
        entryFixture({ id: 'first', type: 'goal', name: 'First', childIds: ['shared'] }),
        entryFixture({ id: 'second', type: 'goal', name: 'Second', childIds: ['shared'] }),
        entryFixture({ id: 'shared', type: 'goal', name: 'Shared', childIds: ['metric'] }),
        entryFixture({ id: 'metric', type: 'metric', name: 'Metric' })
    ];
    act(() => {
        ReactDOM.render(
            <GoalList
                items={items}
                labels={[]}
                entries={items}
                selectedId={null}
                busy={false}
                onSelect={() => {}}
                onDelete={() => {}}
                onCreateGoal={() => {}}
                onLink={async () => true}
                onRearrange={async () => true}
            />,
            container
        );
    });
    const row = (path: string) =>
        required(container.querySelector<HTMLElement>(`[data-path="${path}"]`));
    expect(row('group').querySelector('.hierarchy-guides')).toBeNull();
    expect(
        row('group/first')
            .querySelector('.hierarchy-guide-branch')
            ?.classList.contains('hierarchy-guide-continues')
    ).toBe(true);
    expect(
        row('group/second')
            .querySelector('.hierarchy-guide-branch')
            ?.classList.contains('hierarchy-guide-continues')
    ).toBe(false);
    expect(
        row('group/first/shared')
            .querySelector('.hierarchy-guide')
            ?.classList.contains('hierarchy-guide-continues')
    ).toBe(true);
    expect(
        row('group/second/shared')
            .querySelector('.hierarchy-guide')
            ?.classList.contains('hierarchy-guide-continues')
    ).toBe(false);
    expect(row('group/first/shared/metric').querySelectorAll('.hierarchy-guide')).toHaveLength(3);
    expect(row('group/first/shared/metric').style.getPropertyValue('--row-depth')).toBe('3');
    expect(
        row('group/first/shared/metric')
            .querySelector('.hierarchy-guides')
            ?.getAttribute('aria-hidden')
    ).toBe('true');
    act(() => Simulate.click(required(row('group/first').querySelector('.branch-toggle'))));
    expect(container.querySelector('[data-path="group/first/shared"]')).toBeNull();
    expect(row('group/second/shared').querySelectorAll('.hierarchy-guide')).toHaveLength(2);
    expect(
        row('group/first')
            .querySelector('.hierarchy-guide-branch')
            ?.classList.contains('hierarchy-guide-continues')
    ).toBe(true);
});

test('given collapsed branches, reordering roots preserves the current expansion state', () => {
    const initial = [
        entryFixture({ id: 'first', type: 'goal', name: 'First', childIds: ['child'] }),
        entryFixture({ id: 'child', type: 'goal', name: 'Child' }),
        entryFixture({ id: 'second', type: 'goal', name: 'Second', childIds: ['other'] }),
        entryFixture({ id: 'other', type: 'goal', name: 'Other' })
    ];
    const renderList = (items: WorkspaceEntry[]) => {
        ReactDOM.render(
            <GoalList
                items={items}
                labels={[]}
                entries={items}
                selectedId={null}
                busy={false}
                onSelect={() => {}}
                onDelete={() => {}}
                onCreateGoal={() => {}}
                onLink={async () => true}
                onRearrange={async () => true}
            />,
            container
        );
    };
    act(() => renderList(initial));
    act(() => Simulate.click(required(container.querySelector('[aria-label="Collapse First"]'))));
    expect(container.querySelector('[data-path="first/child"]')).toBeNull();
    act(() => renderList(moveListEntry(initial, 'second', 'first', 'before')));
    expect(
        [...container.querySelectorAll<HTMLElement>('.entry-row')].map((row) => row.dataset.path)
    ).toEqual(['second', 'second/other', 'first']);
    expect(container.querySelector('[aria-label="Expand First"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Collapse Second"]')).not.toBeNull();
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
