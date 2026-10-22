import React, { useEffect, useRef, useState } from 'react';
import { LoaderCircle, X } from 'lucide-react';
import IconButton from '../../../components/ui/IconButton';
import AssigneePicker from '../../../components/assignees/AssigneePicker';
import MetricFields from './MetricFields';
import type { MetricValues } from './MetricFields';
import { canContain, entryTypes } from '../model/entries';
import type { Assignee, EntryDraft, EntryType, WorkspaceEntry } from '../../../types/workspace';

interface EntryDialogProps {
    kind: 'create' | 'delete';
    item?: WorkspaceEntry;
    items: WorkspaceEntry[];
    initialType: EntryType;
    initialParentId: string;
    busy: boolean;
    error: string;
    onClose: () => void;
    onCreate: (draft: EntryDraft, parentId: string) => Promise<void>;
    onDelete: () => Promise<void>;
}
export default function EntryDialog({
    kind,
    item,
    items,
    initialType,
    initialParentId,
    busy,
    error,
    onClose,
    onCreate,
    onDelete
}: EntryDialogProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState(initialType);
    const [parentId, setParentId] = useState(initialParentId);
    const [assignees, setAssignees] = useState<Assignee[]>([]);
    const [metric, setMetric] = useState<MetricValues>({
        currentValue: 0,
        targetValue: 100,
        unit: ''
    });
    const parentOptions = items.filter((candidate) => canContain(candidate.type, type));
    const validParentId = parentOptions.some((candidate) => candidate.id === parentId)
        ? parentId
        : '';
    const label = entryTypes[kind === 'delete' && item ? item.type : type].label.toLowerCase();
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const element = dialog.current;
        if (!element) return;
        element.showModal();
        return () => {
            if (element.open) element.close();
        };
    }, []);

    return (
        <dialog
            ref={dialog}
            className="item-dialog"
            aria-labelledby="dialog-title"
            onCancel={(event) => {
                if (busy) event.preventDefault();
                else onClose();
            }}
        >
            <form
                onSubmit={async (event) => {
                    event.preventDefault();
                    if (kind === 'delete') await onDelete();
                    else
                        await onCreate(
                            {
                                type,
                                name,
                                description,
                                assignees: type === 'group' ? [] : assignees,
                                ...(type === 'metric' ? metric : {})
                            },
                            validParentId
                        );
                }}
            >
                <div className="dialog-heading">
                    <h2 id="dialog-title">
                        {kind === 'delete' ? `Delete ${label}?` : `New ${label}`}
                    </h2>
                    <IconButton label="Close dialog" disabled={busy} onClick={onClose}>
                        <X size={18} />
                    </IconButton>
                </div>
                {error && (
                    <p className="dialog-error" role="alert">
                        {error}
                    </p>
                )}
                {kind === 'delete' ? (
                    <p className="delete-message">
                        Delete <strong>{item?.name}</strong> and its connections? Its contents will
                        remain in the workspace.
                    </p>
                ) : (
                    <React.Fragment>
                        <label htmlFor="new-type">Type</label>
                        <select
                            id="new-type"
                            value={type}
                            disabled={busy}
                            onChange={(event) => setType(event.target.value as EntryType)}
                        >
                            {Object.entries(entryTypes).map(([value, info]) => (
                                <option key={value} value={value}>
                                    {info.label}
                                </option>
                            ))}
                        </select>
                        <label htmlFor="new-parent">
                            {type === 'metric'
                                ? 'Goal'
                                : type === 'group'
                                  ? 'Inside'
                                  : 'Group or parent goal'}
                        </label>
                        <select
                            id="new-parent"
                            value={validParentId}
                            required={type === 'metric'}
                            disabled={busy}
                            onChange={(event) => setParentId(event.target.value)}
                        >
                            <option value="">
                                {type === 'metric'
                                    ? 'Select a goal'
                                    : type === 'group'
                                      ? 'Workspace root'
                                      : 'No group or parent goal'}
                            </option>
                            {parentOptions.map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                    {candidate.name} ({entryTypes[candidate.type].label})
                                </option>
                            ))}
                        </select>
                        <label htmlFor="new-name">Name</label>
                        <input
                            id="new-name"
                            autoFocus
                            required
                            maxLength={80}
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            disabled={busy}
                        />
                        {type === 'metric' && (
                            <MetricFields
                                value={metric}
                                onChange={setMetric}
                                disabled={busy}
                                prefix="new-metric"
                            />
                        )}
                        {type !== 'group' && (
                            <AssigneePicker
                                value={assignees}
                                onChange={setAssignees}
                                disabled={busy}
                                id="new-assignees"
                            />
                        )}
                        <label htmlFor="new-description">
                            Description <span className="optional">optional</span>
                        </label>
                        <textarea
                            id="new-description"
                            rows={3}
                            maxLength={500}
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            disabled={busy}
                        />
                    </React.Fragment>
                )}
                <div className="dialog-actions">
                    <button
                        className="button secondary"
                        type="button"
                        disabled={busy}
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                    <button
                        className={`button ${kind === 'delete' ? 'danger' : 'primary'}`}
                        type="submit"
                        disabled={
                            busy ||
                            (kind !== 'delete' &&
                                (!name.trim() || (type === 'metric' && !validParentId)))
                        }
                    >
                        {busy && <LoaderCircle size={16} className="spin" />}
                        {kind === 'delete' ? `Delete ${label}` : `Create ${label}`}
                    </button>
                </div>
            </form>
        </dialog>
    );
}
