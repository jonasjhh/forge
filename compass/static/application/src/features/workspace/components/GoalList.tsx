import React, { useRef, useState } from 'react';
import {
    ChevronRight,
    Folder as GroupIcon,
    Gauge,
    GitBranch,
    GripVertical,
    Layers,
    Link2,
    Plus,
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
import { buildListRows, canConnect, entryTypes } from '../model/entries';
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
    onDelete: (path: string) => void;
    onCreateGoal: (parentId: string) => void;
    onLink: (sourceId: string, parentId: string) => Promise<boolean>;
    onRearrange: (
        sourcePath: string,
        targetPath: string,
        placement: DropPlacement
    ) => Promise<boolean>;
}

const listCollisionDetection: CollisionDetection = (args) => {
    const collisions = args.pointerCoordinates ? pointerWithin(args) : closestCenter(args);
    const link = collisions.find((collision) => String(collision.id).endsWith(':link'));
    return args.pointerCoordinates && link ? [link] : collisions;
};

export default function GoalList({
    items,
    labels,
    entries,
    selectedId,
    busy,
    onSelect,
    onDelete,
    onCreateGoal,
    onLink,
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
    const followingSiblings = new Map<string, boolean>();
    const nextPaths: string[] = [];
    for (let index = projectedRows.length - 1; index >= 0; index--) {
        const row = projectedRows[index];
        const nextPath = nextPaths[row.depth];
        followingSiblings.set(
            row.path,
            Boolean(
                nextPath &&
                nextPath.split('/').slice(0, -1).join('/') ===
                    row.path.split('/').slice(0, -1).join('/')
            )
        );
        nextPaths.length = row.depth + 1;
        nextPaths[row.depth] = row.path;
    }
    const [activeEntry, setActiveEntry] = useState<WorkspaceEntry | null>(null);
    const [linkingDrag, setLinkingDrag] = useState(false);
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
            const placement = source.mode === 'link' ? 'link' : destination.placement;
            const linking = placement === 'link';
            const targetId = destination.path.split('/').pop()!;
            const saved =
                placement === 'link'
                    ? await onLink(source.entry.id, targetId)
                    : await onRearrange(source.path, destination.path, placement);
            if (saved && (linking || destination.placement === 'inside')) {
                setCollapseState((current) => {
                    if (current.filterKey !== filterKey) return current;
                    const paths = new Set(current.paths);
                    paths.delete(destination.path);
                    return { ...current, paths };
                });
            }
            setMoveStatus(
                saved
                    ? `${linking ? 'Linked' : 'Moved'} ${source.entry.name}.`
                    : 'The change could not be saved.'
            );
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
                    setLinkingDrag(active.data.current?.mode === 'link');
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
                        <col className="column-actions" />
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
                            <th scope="col" className="column-actions">
                                <span className="visually-hidden">Actions</span>
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
                                    onSelect={onSelect}
                                    canLink={Boolean(
                                        activeEntry && canConnect(items, entry, activeEntry)
                                    )}
                                >
                                    {(dragHandle, dropTargets, linkTarget) => (
                                        <React.Fragment>
                                            <th scope="row" className="hierarchy-cell column-name">
                                                {dropTargets}
                                                {depth > 0 && (
                                                    <span
                                                        className="hierarchy-guides"
                                                        aria-hidden="true"
                                                    >
                                                        {path
                                                            .split('/')
                                                            .slice(0, -1)
                                                            .map((ancestorId, level) => {
                                                                const branchPath = path
                                                                    .split('/')
                                                                    .slice(0, level + 2)
                                                                    .join('/');
                                                                const continues =
                                                                    followingSiblings.get(
                                                                        branchPath
                                                                    );
                                                                const current = level === depth - 1;
                                                                return (
                                                                    <span
                                                                        key={ancestorId}
                                                                        className={`hierarchy-guide ${current ? 'hierarchy-guide-branch' : ''} ${continues ? 'hierarchy-guide-continues' : ''}`}
                                                                        data-branch-path={
                                                                            branchPath
                                                                        }
                                                                    />
                                                                );
                                                            })}
                                                    </span>
                                                )}
                                                <div className="hierarchy-name">
                                                    {dragHandle}
                                                    {linkTarget}
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
                                                {entry.type === 'group' ? (
                                                    <span className="muted">-</span>
                                                ) : (
                                                    <span
                                                        className="count parent-goal-count"
                                                        tabIndex={0}
                                                        title={
                                                            parents.length
                                                                ? parents
                                                                      .map((parent) => parent.name)
                                                                      .join('\n')
                                                                : 'No parent goals'
                                                        }
                                                        aria-label={`${parents.length} ${parents.length === 1 ? 'parent goal' : 'parent goals'}${parents.length ? `: ${parents.map((parent) => parent.name).join(', ')}` : ''}`}
                                                    >
                                                        {parents.length}
                                                    </span>
                                                )}
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
                                            <td className="column-actions">
                                                <div className="row-actions">
                                                    {entry.type !== 'metric' && (
                                                        <IconButton
                                                            label={`Add goal under ${entry.name}`}
                                                            disabled={busy}
                                                            onClick={() => onCreateGoal(entry.id)}
                                                        >
                                                            <Plus size={16} aria-hidden="true" />
                                                        </IconButton>
                                                    )}
                                                    <IconButton
                                                        label={`Delete ${entryTypes[entry.type].label.toLowerCase()} ${entry.name}`}
                                                        disabled={busy}
                                                        onClick={() => onDelete(path)}
                                                    >
                                                        <Trash2 size={16} aria-hidden="true" />
                                                    </IconButton>
                                                </div>
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
                            {linkingDrag ? <Link2 size={16} /> : <GripVertical size={16} />}
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
