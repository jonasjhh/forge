import React from 'react';
import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { GripVertical, Link2 } from 'lucide-react';
import type { DropPlacement, ListRow, WorkspaceEntry } from '../../../types/workspace';

export interface DragEntryData {
    path: string;
    entry: WorkspaceEntry;
    mode: 'move' | 'link';
}
export interface DropTargetData {
    path: string;
    placement: DropPlacement | 'link';
}

interface DraggableListRowProps {
    row: ListRow;
    selectedId: string | null;
    busy: boolean;
    onSelect: (id: string) => void;
    canLink: boolean;
    children: (
        dragHandle: React.ReactNode,
        dropTargets: React.ReactNode,
        linkTarget: React.ReactNode
    ) => React.ReactNode;
}

function LinkDropTarget({
    path,
    entry,
    busy,
    canLink
}: {
    path: string;
    entry: WorkspaceEntry;
    busy: boolean;
    canLink: boolean;
}) {
    const { isOver, setNodeRef: setDropRef } = useDroppable({
        id: `${path}:link`,
        data: { path, placement: 'link' },
        disabled: busy || entry.type === 'metric'
    });
    const {
        attributes,
        listeners,
        setNodeRef: setDragRef,
        setActivatorNodeRef
    } = useDraggable({
        id: `${path}:link-source`,
        data: { path, entry, mode: 'link' },
        disabled: busy
    });
    return (
        <button
            ref={(element) => {
                setDropRef(element);
                setDragRef(element);
                setActivatorNodeRef(element);
            }}
            type="button"
            className={`link-drop-target ${isOver ? 'is-over' : ''}`}
            data-valid={canLink}
            disabled={busy}
            {...attributes}
            {...listeners}
            aria-label={`Link ${entry.name}`}
            title={`Drag to link ${entry.name} under another entry`}
        >
            <Link2 size={16} aria-hidden="true" />
        </button>
    );
}

function DropZone({ path, placement, disabled }: DropTargetData & { disabled: boolean }) {
    const { isOver, setNodeRef } = useDroppable({
        id: `${path}:${placement}`,
        data: { path, placement },
        disabled
    });
    return (
        <div
            ref={setNodeRef}
            className={`row-drop-zone drop-${placement} ${isOver ? 'is-over' : ''}`}
            data-drop-placement={placement}
            aria-hidden="true"
        />
    );
}

export default function DraggableListRow({
    row,
    selectedId,
    busy,
    onSelect,
    canLink,
    children
}: DraggableListRowProps) {
    const { entry, path, depth } = row;
    const { active } = useDndContext();
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
        id: path,
        data: { path, entry, mode: 'move' },
        disabled: busy
    });
    const dragHandle = (
        <button
            type="button"
            ref={setActivatorNodeRef}
            className="drag-handle"
            title={`Move ${entry.name}`}
            disabled={busy}
            {...attributes}
            {...listeners}
            aria-label={`Move ${entry.name}`}
        >
            <GripVertical size={16} />
        </button>
    );
    const dropTargets = (
        <div className="row-drop-targets" data-active={Boolean(active)}>
            <DropZone
                path={path}
                placement="before"
                disabled={busy || active?.data.current?.path === path}
            />
            {entry.type !== 'metric' && (
                <DropZone
                    path={path}
                    placement="inside"
                    disabled={busy || active?.data.current?.path === path}
                />
            )}
            <DropZone
                path={path}
                placement="after"
                disabled={busy || active?.data.current?.path === path}
            />
        </div>
    );
    return (
        <tr
            ref={setNodeRef}
            data-entry-id={entry.id}
            data-depth={depth}
            data-path={path}
            style={{ '--row-depth': depth } as React.CSSProperties}
            className={`entry-row entry-row-${entry.type} ${selectedId === entry.id ? 'selected-row' : ''} ${isDragging ? 'is-dragging' : ''}`}
            onClick={(event) => {
                if (active || isDragging) return;
                if (
                    event.target instanceof Element &&
                    event.target.closest(
                        'button, a, input, select, textarea, summary, [role="button"]'
                    )
                )
                    return;
                onSelect(entry.id);
            }}
        >
            {children(
                dragHandle,
                dropTargets,
                <LinkDropTarget path={path} entry={entry} busy={busy} canLink={canLink} />
            )}
        </tr>
    );
}
