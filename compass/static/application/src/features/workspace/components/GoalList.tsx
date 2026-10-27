import React, { useRef, useState } from 'react';
import {
    ChevronRight,
    Folder as GroupIcon,
    Gauge,
    GitBranch,
    GripVertical,
    Layers,
    Rocket,
    Target,
    Trash2
} from 'lucide-react';
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
import { buildListRows, entryTypes } from '../model/entries';
import AssigneeChip from '../../../components/assignees/AssigneeChip';
import LabelChip from '../../../components/labels/LabelChip';
import IconButton from '../../../components/ui/IconButton';
import DraggableListRow from './DraggableListRow';
import type { CollisionDetection, DragEndEvent } from '@dnd-kit/core';
import type { DragEntryData, DropTargetData } from './DraggableListRow';
import type { DropPlacement, WorkspaceEntry, WorkspaceLabel } from '../../../types/workspace';

const goalCategoryIcons = {
    Decision: GitBranch,
    Capability: Layers,
    Delivery: Rocket
};

const columns = [
    { label: 'Name', className: 'column-name' },
    { label: 'Assignees', className: 'column-assignees' },
    { label: 'Labels', className: 'column-labels' },
    { label: 'Parent goals', className: 'column-parents' },
    { label: 'Metrics', className: 'column-metrics' }
];
const minimumColumnWidths = [24, 12, 12, 12, 8];
const initialColumnWidths = [40, 19, 19, 14, 8];

function resizeColumnPair(widths: number[], index: number, amount: number): number[] {
    const pairWidth = widths[index] + widths[index + 1];
    const minimumLeft = minimumColumnWidths[index];
    const maximumLeft = pairWidth - minimumColumnWidths[index + 1];
    if (maximumLeft < minimumLeft) return widths;
    const leftWidth = Math.max(minimumLeft, Math.min(maximumLeft, widths[index] + amount));
    return widths.map((width, columnIndex) =>
        columnIndex === index
            ? leftWidth
            : columnIndex === index + 1
              ? pairWidth - leftWidth
              : width
    );
}

interface ResizeGesture {
    index: number;
    startX: number;
    tableWidth: number;
    widths: number[];
}

interface GoalListProps {
    items: WorkspaceEntry[];
    labels: WorkspaceLabel[];
    entries: WorkspaceEntry[];
    selectedId: string | null;
    busy: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onRearrange: (
        sourcePath: string,
        targetPath: string,
        placement: DropPlacement
    ) => Promise<boolean>;
}

const listCollisionDetection: CollisionDetection = (args) => {
    return args.pointerCoordinates ? pointerWithin(args) : closestCenter(args);
};

export default function GoalList({
    items,
    labels,
    entries,
    selectedId,
    busy,
    onSelect,
    onDelete,
    onRearrange
}: GoalListProps) {
    const filterKey = entries.map((entry) => entry.id).join('|');
    const [collapseState, setCollapseState] = useState(() => ({
        filterKey,
        paths: new Set<string>()
    }));
    const [rowLimit, setRowLimit] = useState(250);
    const collapsedPaths =
        collapseState.filterKey === filterKey ? collapseState.paths : new Set<string>();
    const projectedRows = buildListRows(items, entries, collapsedPaths, rowLimit + 1);
    const rows = projectedRows.slice(0, rowLimit);
    const [activeEntry, setActiveEntry] = useState<WorkspaceEntry | null>(null);
    const [moveStatus, setMoveStatus] = useState('');
    const [columnWidths, setColumnWidths] = useState(initialColumnWidths);
    const tableRef = useRef<HTMLTableElement>(null);
    const resizeGesture = useRef<ResizeGesture | null>(null);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(KeyboardSensor)
    );

    async function finishDrag({ active, over }: DragEndEvent): Promise<void> {
        setActiveEntry(null);
        const source = active.data.current as DragEntryData | undefined;
        const destination = over?.data.current as DropTargetData | undefined;
        if (!source || !destination) {
            setMoveStatus('Move cancelled.');
            return;
        }
        try {
            const saved = await onRearrange(source.path, destination.path, destination.placement);
            if (saved && destination.placement === 'inside') {
                setCollapseState((current) => {
                    if (current.filterKey !== filterKey) return current;
                    const paths = new Set(current.paths);
                    paths.delete(destination.path);
                    return { ...current, paths };
                });
            }
            setMoveStatus(saved ? `Moved ${source.entry.name}.` : 'The move could not be saved.');
        } catch (failure) {
            setMoveStatus(
                failure instanceof Error ? failure.message : 'The move could not be saved.'
            );
        }
    }

    function toggleBranch(path: string): void {
        setCollapseState((current) => {
            const next = new Set(current.filterKey === filterKey ? current.paths : []);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return { filterKey, paths: next };
        });
    }

    function startColumnResize(event: React.PointerEvent<HTMLButtonElement>, index: number): void {
        event.preventDefault();
        event.stopPropagation();
        const tableWidth = tableRef.current?.getBoundingClientRect().width;
        if (!tableWidth) return;
        resizeGesture.current = {
            index,
            startX: event.clientX,
            tableWidth,
            widths: columnWidths
        };
        event.currentTarget.setPointerCapture(event.pointerId);
    }

    function resizeColumn(event: React.PointerEvent<HTMLButtonElement>): void {
        const gesture = resizeGesture.current;
        if (!gesture) return;
        event.preventDefault();
        event.stopPropagation();
        const amount = ((event.clientX - gesture.startX) / gesture.tableWidth) * 100;
        setColumnWidths(resizeColumnPair(gesture.widths, gesture.index, amount));
    }

    function finishColumnResize(event: React.PointerEvent<HTMLButtonElement>): void {
        event.stopPropagation();
        resizeGesture.current = null;
    }

    function resizeColumnWithKeyboard(
        event: React.KeyboardEvent<HTMLButtonElement>,
        index: number
    ): void {
        const amount = event.key === 'ArrowRight' ? 2 : event.key === 'ArrowLeft' ? -2 : 0;
        if (!amount) return;
        event.preventDefault();
        setColumnWidths((current) => resizeColumnPair(current, index, amount));
    }

    return (
        <div className="goal-list-view">
            <DndContext
                sensors={sensors}
                collisionDetection={listCollisionDetection}
                onDragStart={({ active }) => {
                    setMoveStatus('');
                    setActiveEntry(
                        (active.data.current as DragEntryData | undefined)?.entry || null
                    );
                }}
                onDragEnd={finishDrag}
                onDragCancel={() => {
                    setActiveEntry(null);
                    setMoveStatus('Move cancelled.');
                }}
            >
                <table id="workspace-entry-table" ref={tableRef} className="goal-table">
                    <caption className="visually-hidden">
                        Groups, goals, sub-goals, and metrics
                    </caption>
                    <colgroup>
                        {columns.map((column, index) => (
                            <col
                                key={column.className}
                                className={column.className}
                                style={{ width: `${columnWidths[index]}%` }}
                            />
                        ))}
                    </colgroup>
                    <thead>
                        <tr>
                            {columns.map((column, index) => (
                                <th key={column.className} scope="col" className={column.className}>
                                    {column.label}
                                    {index < columns.length - 1 && (
                                        <button
                                            type="button"
                                            className="column-resizer"
                                            role="separator"
                                            aria-label={`Resize ${column.label} column`}
                                            aria-controls="workspace-entry-table"
                                            aria-orientation="vertical"
                                            aria-valuemin={minimumColumnWidths[index]}
                                            aria-valuemax={
                                                columnWidths[index] +
                                                columnWidths[index + 1] -
                                                minimumColumnWidths[index + 1]
                                            }
                                            aria-valuenow={Math.round(columnWidths[index])}
                                            title={`Resize ${column.label} column`}
                                            onPointerDown={(event) =>
                                                startColumnResize(event, index)
                                            }
                                            onPointerMove={resizeColumn}
                                            onPointerUp={finishColumnResize}
                                            onPointerCancel={finishColumnResize}
                                            onKeyDown={(event) =>
                                                resizeColumnWithKeyboard(event, index)
                                            }
                                        >
                                            <GripVertical size={14} aria-hidden="true" />
                                        </button>
                                    )}
                                </th>
                            ))}
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
                            const goalCategory = entry.goalCategory ?? 'Delivery';
                            const label =
                                entry.type === 'group'
                                    ? 'Group'
                                    : entry.type === 'metric'
                                      ? 'Metric'
                                      : goalCategory;
                            const EntryIcon =
                                entry.type === 'group'
                                    ? GroupIcon
                                    : entry.type === 'metric'
                                      ? Gauge
                                      : goalCategoryIcons[goalCategory];
                            const iconClass =
                                entry.type === 'goal'
                                    ? `entry-icon-${goalCategory.toLowerCase()}`
                                    : `entry-icon-${entry.type}`;
                            return (
                                <DraggableListRow
                                    key={path}
                                    row={{ entry, depth, path, hasChildren }}
                                    selectedId={selectedId}
                                    busy={busy}
                                >
                                    {(dragHandle, dropTargets) => (
                                        <React.Fragment>
                                            <th scope="row" className="hierarchy-cell column-name">
                                                {dropTargets}
                                                <div
                                                    className="hierarchy-name"
                                                    style={
                                                        {
                                                            '--row-depth': depth
                                                        } as React.CSSProperties
                                                    }
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
                                                        aria-label={`Open ${entryTypes[entry.type].label.toLowerCase()} ${entry.name}`}
                                                        aria-pressed={selectedId === entry.id}
                                                        onClick={() => onSelect(entry.id)}
                                                    >
                                                        <EntryIcon
                                                            size={17}
                                                            className={iconClass}
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
                                                    <IconButton
                                                        label={`Delete ${entryTypes[entry.type].label.toLowerCase()} ${entry.name}`}
                                                        disabled={busy}
                                                        onClick={() => onDelete(entry.id)}
                                                    >
                                                        <Trash2 size={16} aria-hidden="true" />
                                                    </IconButton>
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
                                                            {entry.type === 'group'
                                                                ? '-'
                                                                : 'Unassigned'}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="column-labels">
                                                <div className="table-labels">
                                                    {(entry.labelIds ?? []).map((id) => {
                                                        const label = labels.find(
                                                            (candidate) => candidate.id === id
                                                        );
                                                        return label ? (
                                                            <LabelChip
                                                                key={label.id}
                                                                label={label}
                                                            />
                                                        ) : null;
                                                    })}
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
                                                            {entry.type === 'group' ? '-' : 'None'}
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
                    <h2>No matching groups, goals, or metrics</h2>
                </div>
            )}
        </div>
    );
}
