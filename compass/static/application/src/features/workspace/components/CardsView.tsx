import React from 'react';
import AssigneeChip from '../../../components/assignees/AssigneeChip';
import LabelChip from '../../../components/labels/LabelChip';
import type { WorkspaceEntry, WorkspaceLabel } from '../../../types/workspace';

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

export default function CardsView({ items, labels, selectedId, onSelect }: CardsViewProps) {
    const deliveries = items.filter(
        (item) => item.type === 'goal' && (item.goalCategory ?? 'Delivery') === 'Delivery'
    );
    const selected = deliveries.find((delivery) => delivery.id === selectedId) ?? deliveries[0];
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
                        <span className="delivery-card-eyebrow">Delivery</span>
                        <h2>{selected.name}</h2>
                        {selected.description && <p>{selected.description}</p>}
                    </header>
                    <div className="delivery-card-content">
                        {selected.assignees.length > 0 && (
                            <CardSection title="Assignees">
                                <div className="delivery-card-assignees">
                                    {selected.assignees.map((assignee) => (
                                        <AssigneeChip key={assignee.accountId} user={assignee} />
                                    ))}
                                </div>
                            </CardSection>
                        )}
                        {selectedLabels.length > 0 && (
                            <CardSection title="Labels">
                                <div className="delivery-card-labels">
                                    {selectedLabels.map((label) => (
                                        <LabelChip key={label.id} label={label} />
                                    ))}
                                </div>
                            </CardSection>
                        )}
                        {parents.length > 0 && (
                            <CardSection title="Parent goals">
                                <ul className="delivery-card-relations">
                                    {parents.map((parent) => (
                                        <li key={parent.id}>{parent.name}</li>
                                    ))}
                                </ul>
                            </CardSection>
                        )}
                        {subGoals.length > 0 && (
                            <CardSection title="Sub-goals">
                                <ul className="delivery-card-relations">
                                    {subGoals.map((goal) => (
                                        <li key={goal.id}>{goal.name}</li>
                                    ))}
                                </ul>
                            </CardSection>
                        )}
                        {metrics.length > 0 && (
                            <CardSection title="Metrics">
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
                            </CardSection>
                        )}
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
