import React, { useState } from 'react';
import { ChevronRight, Folder, Gauge, GripVertical, Target } from 'lucide-react';
import {
    closestCenter,
    DndContext,
    DragOverlay,
    KeyboardSensor,
    PointerSensor,
    pointerWithin,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import { buildListRows } from './entries';
import AssigneeChip from './AssigneeChip';
import DraggableListRow from './DraggableListRow';

function listCollisionDetection(args) {
    return args.pointerCoordinates ? pointerWithin(args) : closestCenter(args);
}

export default function GoalList({ items, entries, selectedId, busy, onSelect, onRearrange }) {
    const filterKey = entries.map((entry) => entry.id).join('|');
    const [collapseState, setCollapseState] = useState(() => ({ filterKey, paths: new Set() }));
    const [rowLimit, setRowLimit] = useState(250);
    const collapsedPaths = collapseState.filterKey === filterKey ? collapseState.paths : new Set();
    const projectedRows = buildListRows(items, entries, collapsedPaths, rowLimit + 1);
    const rows = projectedRows.slice(0, rowLimit);
    const [activeEntry, setActiveEntry] = useState(null);
    const [moveStatus, setMoveStatus] = useState('');
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor)
    );

    async function finishDrag({ active, over }) {
        setActiveEntry(null);
        if (!over) {
            setMoveStatus('Move cancelled.');
            return;
        }
        try {
            const saved = await onRearrange(
                active.data.current.path,
                over.data.current.path,
                over.data.current.placement
            );
            if (saved && over.data.current.placement === 'inside') {
                setCollapseState((current) => {
                    if (current.filterKey !== filterKey) return current;
                    const paths = new Set(current.paths);
                    paths.delete(over.data.current.path);
                    return { ...current, paths };
                });
            }
            setMoveStatus(
                saved ? `Moved ${active.data.current.entry.name}.` : 'The move could not be saved.'
            );
        } catch (failure) {
            setMoveStatus(failure.message);
        }
    }

    function toggleBranch(path) {
        setCollapseState((current) => {
            const next = new Set(current.filterKey === filterKey ? current.paths : []);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return { filterKey, paths: next };
        });
    }
    return (
        <div className="goal-list-view">
            <DndContext
                sensors={sensors}
                collisionDetection={listCollisionDetection}
                onDragStart={({ active }) => {
                    setMoveStatus('');
                    setActiveEntry(active.data.current.entry);
                }}
                onDragEnd={finishDrag}
                onDragCancel={() => {
                    setActiveEntry(null);
                    setMoveStatus('Move cancelled.');
                }}
            >
                <table className="goal-table">
                    <caption className="visually-hidden">
                        Folders, goals, sub-goals, and metrics
                    </caption>
                    <thead>
                        <tr>
                            <th scope="col">Name</th>
                            <th scope="col" className="column-assignees">
                                Assignees
                            </th>
                            <th scope="col" className="column-parents">
                                Parent goals
                            </th>
                            <th scope="col" className="column-metrics">
                                Metrics
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({ entry, depth, path, hasChildren }) => {
                            const parents = items.filter(
                                (candidate) =>
                                    candidate.type === 'goal' &&
                                    candidate.childIds.includes(entry.id)
                            );
                            const metrics = items.filter(
                                (candidate) =>
                                    candidate.type === 'metric' &&
                                    entry.childIds.includes(candidate.id)
                            );
                            const label =
                                entry.type === 'folder'
                                    ? 'Folder'
                                    : entry.type === 'metric'
                                      ? 'Metric'
                                      : parents.length
                                        ? 'Sub-goal'
                                        : 'Goal';
                            const EntryIcon =
                                entry.type === 'folder'
                                    ? Folder
                                    : entry.type === 'metric'
                                      ? Gauge
                                      : Target;
                            return (
                                <DraggableListRow
                                    key={path}
                                    row={{ entry, depth, path }}
                                    selectedId={selectedId}
                                    busy={busy}
                                >
                                    {(dragHandle, dropTargets) => (
                                        <React.Fragment>
                                            <th scope="row" className="hierarchy-cell">
                                                {dropTargets}
                                                <div
                                                    className="hierarchy-name"
                                                    style={{ '--row-depth': depth }}
                                                >
                                                    {dragHandle}
                                                    {hasChildren ? (
                                                        <button
                                                            type="button"
                                                            className="branch-toggle"
                                                            aria-label={`${collapsedPaths.has(path) ? 'Expand' : 'Collapse'} ${entry.name}`}
                                                            title={`${collapsedPaths.has(path) ? 'Expand' : 'Collapse'} ${entry.name}`}
                                                            aria-expanded={
                                                                !collapsedPaths.has(path)
                                                            }
                                                            onClick={() => toggleBranch(path)}
                                                        >
                                                            <ChevronRight size={16} />
                                                        </button>
                                                    ) : (
                                                        <span
                                                            className="branch-spacer"
                                                            aria-hidden="true"
                                                        />
                                                    )}
                                                    <button
                                                        type="button"
                                                        className="goal-name"
                                                        aria-label={`Open ${entry.type} ${entry.name}`}
                                                        aria-pressed={selectedId === entry.id}
                                                        onClick={() => onSelect(entry.id)}
                                                    >
                                                        <EntryIcon
                                                            size={17}
                                                            className={`entry-icon-${entry.type}`}
                                                        />
                                                        <span>
                                                            <span className="goal-name-text">
                                                                {entry.name}
                                                            </span>
                                                            <span className="goal-row-meta">
                                                                {label}
                                                                {entry.type === 'metric'
                                                                    ? ` - ${entry.currentValue ?? 'Not set'} / ${entry.targetValue ?? 'Not set'} ${entry.unit || ''}`
                                                                    : ''}
                                                            </span>
                                                        </span>
                                                    </button>
                                                </div>
                                            </th>
                                            <td className="column-assignees">
                                                <div className="table-assignees">
                                                    {entry.assignees.length ? (
                                                        entry.assignees.map((assignee) => (
                                                            <AssigneeChip
                                                                user={assignee}
                                                                key={assignee.accountId}
                                                            />
                                                        ))
                                                    ) : (
                                                        <span className="muted">
                                                            {entry.type === 'folder'
                                                                ? '-'
                                                                : 'Unassigned'}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="column-parents">
                                                <div className="table-parent-links">
                                                    {parents.length ? (
                                                        parents.map((parent) => (
                                                            <button
                                                                type="button"
                                                                key={parent.id}
                                                                onClick={() => onSelect(parent.id)}
                                                            >
                                                                {parent.name}
                                                            </button>
                                                        ))
                                                    ) : (
                                                        <span className="muted">
                                                            {entry.type === 'folder' ? '-' : 'None'}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="column-metrics">
                                                {entry.type === 'goal' ? (
                                                    <span
                                                        className="count metric-count"
                                                        aria-label={`${metrics.length} ${metrics.length === 1 ? 'metric' : 'metrics'}`}
                                                    >
                                                        {metrics.length}
                                                    </span>
                                                ) : (
                                                    <span className="muted">-</span>
                                                )}
                                            </td>
                                        </React.Fragment>
                                    )}
                                </DraggableListRow>
                            );
                        })}
                    </tbody>
                </table>
                <DragOverlay dropAnimation={null}>
                    {activeEntry && (
                        <div className="drag-preview">
                            <GripVertical size={16} />
                            <span>{activeEntry.name}</span>
                        </div>
                    )}
                </DragOverlay>
            </DndContext>
            {moveStatus && (
                <p className="move-status" role="status">
                    {moveStatus}
                </p>
            )}
            {projectedRows.length > rowLimit && (
                <div className="list-more">
                    <button
                        className="button secondary"
                        type="button"
                        onClick={() => setRowLimit((current) => current + 250)}
                    >
                        Show more
                    </button>
                </div>
            )}
            {!rows.length && (
                <div className="list-empty">
                    <Target size={28} strokeWidth={1.5} />
                    <h2>No matching folders, goals, or metrics</h2>
                </div>
            )}
        </div>
    );
}
