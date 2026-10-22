import React from 'react';
import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { GripVertical } from 'lucide-react';
import type { DropPlacement, ListRow, WorkspaceEntry } from '../../../types/workspace';

export interface DragEntryData {
    path: string;
    entry: WorkspaceEntry;
}
export interface DropTargetData {
    path: string;
    placement: DropPlacement;
}

interface DraggableListRowProps {
    row: ListRow;
    selectedId: string | null;
    busy: boolean;
    children: (dragHandle: React.ReactNode, dropTargets: React.ReactNode) => React.ReactNode;
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
    children
}: DraggableListRowProps) {
    const { entry, path, depth } = row;
    const { active } = useDndContext();
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
        id: path,
        data: { path, entry },
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
            <DropZone path={path} placement="before" disabled={busy || active?.id === path} />
            {entry.type !== 'metric' && (
                <DropZone path={path} placement="inside" disabled={busy || active?.id === path} />
            )}
            <DropZone path={path} placement="after" disabled={busy || active?.id === path} />
        </div>
    );
    return (
        <tr
            ref={setNodeRef}
            data-entry-id={entry.id}
            data-depth={depth}
            data-path={path}
            className={`entry-row entry-row-${entry.type} ${selectedId === entry.id ? 'selected-row' : ''} ${isDragging ? 'is-dragging' : ''}`}
        >
            {children(dragHandle, dropTargets)}
        </tr>
    );
}
