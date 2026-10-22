import assert from 'node:assert/strict';
import test from 'node:test';
import { validateGraph } from './items';

const item = (id: string, childIds: unknown[] = [], type = 'group') => ({
    id,
    type,
    name: id,
    description: '',
    childIds,
    assignees: []
});

test('given a new workspace, an empty graph is accepted', () => {
    assert.deepEqual(validateGraph({ items: [] }), { items: [] });
});

test('given multiple parents, a shared child is accepted', () => {
    const graph = {
        items: [item('project', ['service']), item('team', ['service']), item('service')]
    };
    assert.deepEqual(validateGraph(graph), graph);
});

test('given whitespace and untrusted fields, saved items are normalized', () => {
    const graph = {
        items: [
            { ...item('service'), name: ' Service ', description: ' Notes ', owner: 'untrusted' }
        ]
    };
    assert.deepEqual(validateGraph(graph), {
        items: [{ ...item('service'), name: 'Service', description: 'Notes' }]
    });
});

test('given a self connection, the graph is rejected', () => {
    assert.throws(() => validateGraph({ items: [item('service', ['service'])] }), /cycle/);
});

test('given an indirect cycle, the graph is rejected', () => {
    assert.throws(
        () =>
            validateGraph({
                items: [
                    item('project', ['team']),
                    item('team', ['service']),
                    item('service', ['project'])
                ]
            }),
        /cycle/
    );
});

test('given a missing child, the graph is rejected', () => {
    assert.throws(
        () => validateGraph({ items: [item('project', ['missing'])] }),
        /no longer exists/
    );
});

test('given duplicate connections, the graph is rejected', () => {
    assert.throws(
        () => validateGraph({ items: [item('project', ['service', 'service']), item('service')] }),
        /duplicate connections/
    );
});

test('given duplicate item IDs, the graph is rejected', () => {
    assert.throws(() => validateGraph({ items: [item('service'), item('service')] }), /unique/);
});

test('given an empty item name, the graph is rejected', () => {
    assert.throws(() => validateGraph({ items: [{ ...item('service'), name: '  ' }] }), /names/);
});

test('given an oversized description, the graph is rejected', () => {
    assert.throws(
        () => validateGraph({ items: [{ ...item('service'), description: 'x'.repeat(501) }] }),
        /Descriptions/
    );
});

test('given too many items, the graph is rejected', () => {
    assert.throws(
        () =>
            validateGraph({
                items: Array.from({ length: 101 }, (_, index) => item(`item-${index}`))
            }),
        /100 items/
    );
});

test('given malformed input, the graph is rejected', () => {
    assert.throws(() => validateGraph(null), /100 items/);
    assert.throws(() => validateGraph({ items: [null] }), /valid ID/);
});

test('given more than 300 connections, the graph is rejected', () => {
    const items = Array.from({ length: 26 }, (_, index) =>
        item(
            `item-${index}`,
            Array.from({ length: 25 - index }, (_, offset) => `item-${index + offset + 1}`)
        )
    );
    assert.throws(() => validateGraph({ items }), /300 connections/);
});

test('given a non-string connection ID, the graph is rejected', () => {
    assert.throws(() => validateGraph({ items: [item('project', [null])] }), /reference item IDs/);
});

test('given an entry without a type, validation rejects it', () => {
    assert.throws(
        () =>
            validateGraph({
                items: [
                    { id: 'group', name: 'Group', description: '', childIds: [], assignees: [] }
                ]
            }),
        /groups, goals, or metrics/
    );
});

test('given groups, nested goals and a metric, the hierarchy is accepted', () => {
    const metric = {
        ...item('metric', [], 'metric'),
        currentValue: 10,
        targetValue: 20,
        unit: '%'
    };
    const graph = {
        items: [
            item('group', ['nested-group']),
            item('nested-group', ['goal']),
            item('goal', ['subgoal'], 'goal'),
            item('subgoal', ['metric'], 'goal'),
            metric
        ]
    };
    assert.deepEqual(validateGraph(graph), graph);
});

test('given a metric directly in a group, the hierarchy is rejected', () => {
    assert.throws(
        () => validateGraph({ items: [item('group', ['metric']), item('metric', [], 'metric')] }),
        /Groups contain/
    );
});

test('given a group inside a goal, the hierarchy is rejected', () => {
    assert.throws(
        () => validateGraph({ items: [item('goal', ['group'], 'goal'), item('group')] }),
        /Groups contain/
    );
});

test('given a metric with children, the hierarchy is rejected', () => {
    assert.throws(
        () =>
            validateGraph({
                items: [item('metric', ['goal'], 'metric'), item('goal', [], 'goal')]
            }),
        /metrics have no children/
    );
});

test('given assignees on a goal and metric, account IDs and names are saved', () => {
    const assignees = [
        { accountId: 'jira-alice', displayName: 'Alice' },
        { accountId: 'jira-bob', displayName: 'Bob' }
    ];
    const graph = validateGraph({
        items: [
            { ...item('goal', ['metric'], 'goal'), assignees },
            { ...item('metric', [], 'metric'), assignees }
        ]
    });
    assert.deepEqual(
        graph.items.map((entry) => entry.assignees),
        [assignees, assignees]
    );
});

test('given duplicate assignees, the goal is rejected', () => {
    const assignee = { accountId: 'jira-alice', displayName: 'Alice' };
    assert.throws(
        () =>
            validateGraph({
                items: [{ ...item('goal', [], 'goal'), assignees: [assignee, assignee] }]
            }),
        /Assignees must be unique/
    );
});

test('given an invalid assignee, the goal is rejected', () => {
    assert.throws(
        () =>
            validateGraph({
                items: [{ ...item('goal', [], 'goal'), assignees: [{ displayName: 'Alice' }] }]
            }),
        /Jira account ID/
    );
});

test('given assignees on a group, the group is rejected', () => {
    assert.throws(
        () =>
            validateGraph({
                items: [
                    {
                        ...item('group'),
                        assignees: [{ accountId: 'jira-alice', displayName: 'Alice' }]
                    }
                ]
            }),
        /not groups/
    );
});

test('given non-finite metric values, the metric is rejected', () => {
    assert.throws(
        () =>
            validateGraph({ items: [{ ...item('metric', [], 'metric'), currentValue: Infinity }] }),
        /finite numbers/
    );
});

test('given an unknown type, the entry is rejected', () => {
    assert.throws(
        () => validateGraph({ items: [item('unknown', [], 'unknown')] }),
        /groups, goals, or metrics/
    );
});

test('given a standalone goal with no metrics, it is accepted without a group or parent', () => {
    const graph = { items: [item('independent', [], 'goal')] };
    assert.deepEqual(validateGraph(graph), graph);
});

test('given a Jira assignee avatar, its approved URL is persisted', () => {
    const assignee = {
        accountId: 'jira-alice',
        displayName: 'Alice',
        avatarUrl:
            'https://avatar-management--avatars.us-west-2.prod.public.atl-paas.net/initials/AL-5.png'
    };
    const graph = validateGraph({
        items: [{ ...item('goal', [], 'goal'), assignees: [assignee] }]
    });
    assert.deepEqual(graph.items[0].assignees, [assignee]);
});

test('given an unapproved avatar host, the assignee is rejected', () => {
    assert.throws(
        () =>
            validateGraph({
                items: [
                    {
                        ...item('goal', [], 'goal'),
                        assignees: [
                            {
                                accountId: 'jira-alice',
                                displayName: 'Alice',
                                avatarUrl: 'https://untrusted.example/avatar.png'
                            }
                        ]
                    }
                ]
            }),
        /approved Atlassian HTTPS host/
    );
});

test('given a shared nested goal and multiple metrics, every parent relationship is accepted', () => {
    const graph = {
        items: [
            item('first', ['shared'], 'goal'),
            item('second', ['shared'], 'goal'),
            item('shared', ['nested', 'first-metric', 'second-metric'], 'goal'),
            item('nested', [], 'goal'),
            { ...item('first-metric', [], 'metric'), currentValue: 0, targetValue: 100, unit: '%' },
            {
                ...item('second-metric', [], 'metric'),
                currentValue: 10,
                targetValue: 5,
                unit: 'hours'
            }
        ]
    };
    assert.deepEqual(validateGraph(graph), graph);
});
