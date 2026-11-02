import React, { useState } from 'react';
import { ChevronRight, Pencil } from 'lucide-react';
import AssigneeChip from '../../../components/assignees/AssigneeChip';
import LabelChip from '../../../components/labels/LabelChip';
import { GoalStatusBadge } from './GoalStatus';
import { JiraIssueLink } from './JiraIssueField';
import { goalCategoryStyles } from '../model/entries';
import { formatTargetMonth } from '../model/targetMonth';
import type { GoalCategory, WorkspaceEntry, WorkspaceLabel } from '../../../types/workspace';

interface CardsViewProps {
    items: WorkspaceEntry[];
    labels: WorkspaceLabel[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    onEditGoal: (id: string) => void;
}

function CardSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="delivery-card-section">
            <h3>{title}</h3>
            {children}
        </section>
    );
}

const cardGoalCategories: GoalCategory[] = ['Delivery', 'Capability', 'Decision'];

export default function CardsView({
    items,
    labels,
    selectedId,
    onSelect,
    onEditGoal
}: CardsViewProps) {
    const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
    const [navigationLimit, setNavigationLimit] = useState(250);
    const deliveries = items.filter(
        (item) => item.type === 'goal' && (item.goalCategory ?? 'Delivery') === 'Delivery'
    );
    const goals = items.filter((item) => item.type === 'goal');
    const selected = goals.find((goal) => goal.id === selectedId) ?? deliveries[0];
    const itemsById = new Map(items.map((item) => [item.id, item]));
    const deliveryChildren = new Map(
        deliveries.map((delivery) => {
            const found: string[] = [];
            const visited = new Set<string>();
            const pending = [...delivery.childIds].reverse();
            while (pending.length) {
                const childId = pending.pop()!;
                if (visited.has(childId)) continue;
                visited.add(childId);
                const child = itemsById.get(childId);
                if (!child || child.type !== 'goal') continue;
                if ((child.goalCategory ?? 'Delivery') === 'Delivery') found.push(childId);
                else pending.push(...[...child.childIds].reverse());
            }
            return [delivery.id, found] as const;
        })
    );
    const nestedDeliveryIds = new Set([...deliveryChildren.values()].flat());
    const roots = deliveries.filter((delivery) => !nestedDeliveryIds.has(delivery.id));
    const navigationRows: {
        delivery: WorkspaceEntry;
        path: string;
        depth: number;
        hasChildren: boolean;
    }[] = [];
    function appendDelivery(delivery: WorkspaceEntry, parentPath: string, depth: number): void {
        if (navigationRows.length > navigationLimit) return;
        const path = parentPath ? `${parentPath}/${delivery.id}` : delivery.id;
        if (parentPath.split('/').includes(delivery.id)) return;
        const children = deliveryChildren.get(delivery.id) ?? [];
        navigationRows.push({ delivery, path, depth, hasChildren: children.length > 0 });
        if (expandedPaths.has(path)) {
            children.forEach((id) => appendDelivery(itemsById.get(id)!, path, depth + 1));
        }
    }
    roots.forEach((root) => appendDelivery(root, '', 0));

    function selectGoal(id: string): void {
        const path = [id];
        const visited = new Set(path);
        let parent = deliveries.find((delivery) =>
            deliveryChildren.get(delivery.id)?.includes(path[0])
        );
        while (parent && !visited.has(parent.id)) {
            path.unshift(parent.id);
            visited.add(parent.id);
            parent = deliveries.find((delivery) =>
                deliveryChildren.get(delivery.id)?.includes(path[0])
            );
        }
        setExpandedPaths((current) => {
            const next = new Set(current);
            path.slice(0, -1).forEach((_, index) => next.add(path.slice(0, index + 1).join('/')));
            return next;
        });
        onSelect(id);
    }
    const selectedLabels = (selected?.labelIds ?? [])
        .map((id) => labels.find((label) => label.id === id))
        .filter((label): label is WorkspaceLabel => Boolean(label));
    const parents = selected
        ? items.filter(
              (item) =>
                  item.type === 'goal' &&
                  item.id !== selected.id &&
                  item.childIds.includes(selected.id)
          )
        : [];
    const children = (selected?.childIds ?? [])
        .map((id) => itemsById.get(id))
        .filter((item): item is WorkspaceEntry => Boolean(item));
    const subGoals = children.filter((item) => item.type === 'goal');
    const goalsByCategory = cardGoalCategories.map((category) => ({
        category,
        goals: subGoals.filter((goal) => (goal.goalCategory ?? 'Delivery') === category)
    }));
    const metrics = children.filter((item) => item.type === 'metric');

    return (
        <div className="cards-view">
            <aside className="delivery-list" aria-label="Deliveries">
                <div className="delivery-list-heading">
                    <h2>Deliveries</h2>
                    <span className="count" aria-label={`${deliveries.length} deliveries`}>
                        {deliveries.length}
                    </span>
                </div>
                {deliveries.length ? (
                    <div className="delivery-list-items">
                        {navigationRows
                            .slice(0, navigationLimit)
                            .map(({ delivery, path, depth, hasChildren }) => (
                                <div
                                    key={path}
                                    className={`delivery-nav-row${depth === 0 ? ' delivery-nav-root' : ''}`}
                                    style={{ '--delivery-depth': depth } as React.CSSProperties}
                                >
                                    {hasChildren ? (
                                        <button
                                            type="button"
                                            className="delivery-nav-toggle"
                                            aria-label={`${expandedPaths.has(path) ? 'Collapse' : 'Expand'} delivery ${delivery.name}`}
                                            aria-expanded={expandedPaths.has(path)}
                                            onClick={() =>
                                                setExpandedPaths((current) => {
                                                    const next = new Set(current);
                                                    if (next.has(path)) next.delete(path);
                                                    else next.add(path);
                                                    return next;
                                                })
                                            }
                                        >
                                            <ChevronRight size={14} aria-hidden="true" />
                                        </button>
                                    ) : (
                                        <span className="delivery-nav-spacer" />
                                    )}
                                    <button
                                        type="button"
                                        className="delivery-list-item"
                                        aria-pressed={selected?.id === delivery.id}
                                        onClick={() => selectGoal(delivery.id)}
                                    >
                                        {delivery.name}
                                    </button>
                                </div>
                            ))}
                        {navigationRows.length > navigationLimit && (
                            <button
                                type="button"
                                className="button secondary"
                                onClick={() => setNavigationLimit((current) => current + 250)}
                            >
                                Show more deliveries
                            </button>
                        )}
                    </div>
                ) : (
                    <p className="delivery-list-empty">No deliveries</p>
                )}
            </aside>
            {selected ? (
                <article
                    className="delivery-card"
                    aria-label="Delivery details"
                    data-status={selected.status ?? 'undefined'}
                >
                    <header className="delivery-card-header">
                        <div className="delivery-card-header-meta">
                            <span className="delivery-card-eyebrow">
                                {selected.goalCategory ?? 'Delivery'}
                            </span>
                            <div className="delivery-card-status">
                                <GoalStatusBadge status={selected.status} />
                                {!selected.status && (
                                    <button
                                        type="button"
                                        className="delivery-set-status"
                                        onClick={() => onEditGoal(selected.id)}
                                    >
                                        <Pencil size={13} aria-hidden="true" />
                                        Set status
                                    </button>
                                )}
                            </div>
                        </div>
                        <h2>{selected.name}</h2>
                        {selected.description && <p>{selected.description}</p>}
                    </header>
                    <div className="delivery-card-content">
                        <div className="delivery-card-planning-box">
                            <div className="delivery-card-target-row">
                                <span>Target month</span>
                                {selected.targetDate ? (
                                    <time dateTime={`${selected.targetDate}-01`}>
                                        {formatTargetMonth(selected.targetDate)}
                                    </time>
                                ) : (
                                    <span className="muted">Not set</span>
                                )}
                            </div>
                            <div className="delivery-card-data-grid">
                                <CardSection title="Metrics">
                                    {metrics.length ? (
                                        <ul className="delivery-card-metrics">
                                            {metrics.map((metric) => (
                                                <li
                                                    key={metric.id}
                                                    className="delivery-metric-result"
                                                >
                                                    <span className="delivery-metric-name">
                                                        {metric.name}
                                                    </span>
                                                    <dl className="delivery-metric-values">
                                                        <div>
                                                            <dt>Current</dt>
                                                            <dd
                                                                className={
                                                                    metric.currentValue == null
                                                                        ? 'is-missing'
                                                                        : ''
                                                                }
                                                            >
                                                                {metric.currentValue ?? 'Not set'}
                                                                {metric.currentValue != null &&
                                                                    metric.unit && (
                                                                        <span className="delivery-metric-unit">
                                                                            {' '}
                                                                            {metric.unit}
                                                                        </span>
                                                                    )}
                                                            </dd>
                                                        </div>
                                                        <div>
                                                            <dt>Target</dt>
                                                            <dd
                                                                className={
                                                                    metric.targetValue == null
                                                                        ? 'is-missing'
                                                                        : ''
                                                                }
                                                            >
                                                                {metric.targetValue ?? 'Not set'}
                                                                {metric.targetValue != null &&
                                                                    metric.unit && (
                                                                        <span className="delivery-metric-unit">
                                                                            {' '}
                                                                            {metric.unit}
                                                                        </span>
                                                                    )}
                                                            </dd>
                                                        </div>
                                                    </dl>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="delivery-category-empty">-</p>
                                    )}
                                </CardSection>
                                <CardSection title="Labels">
                                    {selectedLabels.length ? (
                                        <div className="delivery-card-labels">
                                            {selectedLabels.map((label) => (
                                                <LabelChip key={label.id} label={label} />
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="delivery-category-empty">-</p>
                                    )}
                                </CardSection>
                            </div>
                        </div>
                        {selected.jiraIssueId && (
                            <CardSection title="Jira-link">
                                <JiraIssueLink
                                    key={selected.jiraIssueId}
                                    issueId={selected.jiraIssueId}
                                />
                            </CardSection>
                        )}
                        {selected.assignees.length > 0 && (
                            <CardSection title="Assignees">
                                <div className="delivery-card-assignees">
                                    {selected.assignees.map((assignee) => (
                                        <AssigneeChip key={assignee.accountId} user={assignee} />
                                    ))}
                                </div>
                            </CardSection>
                        )}
                        {parents.length > 0 && (
                            <CardSection
                                title={parents.length === 1 ? 'Parent goal' : 'Parent goals'}
                            >
                                <div className="delivery-parent-cards">
                                    {parents.map((parent) => (
                                        <button
                                            key={parent.id}
                                            type="button"
                                            className="delivery-parent-card"
                                            data-status={parent.status ?? 'undefined'}
                                            aria-describedby={`card-parent-status-${parent.id}`}
                                            onClick={() => selectGoal(parent.id)}
                                        >
                                            <span className="delivery-parent-category">
                                                {parent.goalCategory ?? 'Delivery'}
                                            </span>
                                            <span className="delivery-parent-name">
                                                {parent.name}
                                            </span>
                                            <GoalStatusBadge
                                                id={`card-parent-status-${parent.id}`}
                                                status={parent.status}
                                                compact
                                            />
                                        </button>
                                    ))}
                                </div>
                            </CardSection>
                        )}
                        <div className="delivery-goal-grid" aria-label="Related goals by category">
                            {goalsByCategory.map(({ category, goals }) => (
                                <section
                                    key={category}
                                    className={`delivery-goal-column delivery-goal-${category.toLowerCase()}`}
                                    data-goal-category={category}
                                    style={
                                        {
                                            '--goal-category-color':
                                                goalCategoryStyles[category].border,
                                            '--goal-category-background':
                                                goalCategoryStyles[category].color
                                        } as React.CSSProperties
                                    }
                                >
                                    <h3>{category}</h3>
                                    {goals.length ? (
                                        <ul className="delivery-card-relations">
                                            {goals.map((goal) => (
                                                <li key={goal.id}>
                                                    <button
                                                        type="button"
                                                        className="delivery-subgoal-card"
                                                        data-status={goal.status ?? 'undefined'}
                                                        aria-label={`Open ${goal.goalCategory ?? 'Delivery'} sub-goal ${goal.name}`}
                                                        aria-describedby={`card-subgoal-status-${goal.id}`}
                                                        onClick={() => selectGoal(goal.id)}
                                                    >
                                                        <span className="delivery-subgoal-name">
                                                            {goal.name}
                                                        </span>
                                                        <GoalStatusBadge
                                                            id={`card-subgoal-status-${goal.id}`}
                                                            status={goal.status}
                                                            compact
                                                        />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="delivery-category-empty">-</p>
                                    )}
                                </section>
                            ))}
                        </div>
                    </div>
                </article>
            ) : (
                <div className="delivery-card-empty" role="status">
                    Select a delivery to view its details.
                </div>
            )}
        </div>
    );
}
