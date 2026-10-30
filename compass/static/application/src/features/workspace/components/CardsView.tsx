import React from 'react';
import AssigneeChip from '../../../components/assignees/AssigneeChip';
import LabelChip from '../../../components/labels/LabelChip';
import { GoalStatusBadge } from './GoalStatus';
import { goalCategoryStyles } from '../model/entries';
import { formatTargetMonth } from '../model/targetMonth';
import type { GoalCategory, WorkspaceEntry, WorkspaceLabel } from '../../../types/workspace';

interface CardsViewProps {
    items: WorkspaceEntry[];
    labels: WorkspaceLabel[];
    selectedId: string | null;
    onSelect: (id: string) => void;
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

export default function CardsView({ items, labels, selectedId, onSelect }: CardsViewProps) {
    const deliveries = items.filter(
        (item) => item.type === 'goal' && (item.goalCategory ?? 'Delivery') === 'Delivery'
    );
    const goals = items.filter((item) => item.type === 'goal');
    const selected = goals.find((goal) => goal.id === selectedId) ?? deliveries[0];
    const itemsById = new Map(items.map((item) => [item.id, item]));
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
                        {deliveries.map((delivery) => (
                            <button
                                key={delivery.id}
                                type="button"
                                className="delivery-list-item"
                                aria-pressed={selected?.id === delivery.id}
                                onClick={() => onSelect(delivery.id)}
                            >
                                {delivery.name}
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className="delivery-list-empty">No deliveries</p>
                )}
            </aside>
            {selected ? (
                <article className="delivery-card" aria-label="Delivery details">
                    <header className="delivery-card-header">
                        <div className="delivery-card-header-meta">
                            <span className="delivery-card-eyebrow">Delivery</span>
                            <GoalStatusBadge status={selected.status} />
                        </div>
                        <h2>{selected.name}</h2>
                        {selected.description && <p>{selected.description}</p>}
                    </header>
                    <div className="delivery-card-content">
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
                                            onClick={() => onSelect(parent.id)}
                                        >
                                            <span className="delivery-parent-category">
                                                {parent.goalCategory ?? 'Delivery'}
                                            </span>
                                            <span className="delivery-parent-name">
                                                {parent.name}
                                            </span>
                                            <GoalStatusBadge status={parent.status} />
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
                                                        aria-label={`Open ${goal.goalCategory ?? 'Delivery'} sub-goal ${goal.name}`}
                                                        onClick={() => onSelect(goal.id)}
                                                    >
                                                        <span className="delivery-subgoal-name">
                                                            {goal.name}
                                                        </span>
                                                        <GoalStatusBadge status={goal.status} />
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
                        <div className="delivery-card-data-grid">
                            <CardSection title="Metrics">
                                {metrics.length ? (
                                    <ul className="delivery-card-metrics">
                                        {metrics.map((metric) => (
                                            <li key={metric.id}>
                                                <span>{metric.name}</span>
                                                <span className="delivery-metric-value">
                                                    {metric.currentValue ?? 'Not set'} /{' '}
                                                    {metric.targetValue ?? 'Not set'}{' '}
                                                    {metric.unit || ''}
                                                </span>
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
                </article>
            ) : (
                <div className="delivery-card-empty" role="status">
                    Select a delivery to view its details.
                </div>
            )}
        </div>
    );
}
