import React, { useEffect, useRef, useState } from 'react';
import { LoaderCircle, X } from 'lucide-react';
import IconButton from '../../../components/ui/IconButton';
import AssigneePicker from '../../../components/assignees/AssigneePicker';
import LabelPicker from '../../../components/labels/LabelPicker';
import MetricFields from './MetricFields';
import type { MetricValues } from './MetricFields';
import { canContain, entryTypes, goalCategories } from '../model/entries';
import type {
    Assignee,
    EntryDraft,
    EntryType,
    GoalCategory,
    WorkspaceEntry,
    WorkspaceLabel
} from '../../../types/workspace';

interface EntryDialogProps {
    kind: 'create' | 'delete';
    item?: WorkspaceEntry;
    deleteParent?: WorkspaceEntry;
    items: WorkspaceEntry[];
    labels: WorkspaceLabel[];
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
    deleteParent,
    items,
    labels,
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
    const [labelIds, setLabelIds] = useState<string[]>([]);
    const [goalCategory, setGoalCategory] = useState<GoalCategory>('Delivery');
    const [targetDate, setTargetDate] = useState('');
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
                                labelIds,
                                ...(type === 'goal'
                                    ? { goalCategory, ...(targetDate ? { targetDate } : {}) }
                                    : {}),
                                ...(type === 'metric' ? metric : {})
                            },
                            validParentId
                        );
                }}
            >
                <div className="dialog-heading">
                    <h2 id="dialog-title">
                        {kind === 'delete'
                            ? deleteParent
                                ? 'Remove connection?'
                                : `Delete ${label}?`
                            : `New ${label}`}
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
                        {deleteParent ? (
                            <React.Fragment>
                                Remove <strong>{item?.name}</strong> from{' '}
                                <strong>{deleteParent.name}</strong>? The item, its other
                                connections, and its contents will remain in the workspace.
                            </React.Fragment>
                        ) : (
                            <React.Fragment>
                                Delete <strong>{item?.name}</strong> and its connections? Its
                                contents will remain in the workspace.
                            </React.Fragment>
                        )}
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
                        {type === 'goal' && (
                            <React.Fragment>
                                <label htmlFor="new-goal-category">Goal type</label>
                                <select
                                    id="new-goal-category"
                                    value={goalCategory}
                                    disabled={busy}
                                    onChange={(event) =>
                                        setGoalCategory(event.target.value as GoalCategory)
                                    }
                                >
                                    {goalCategories.map((category) => (
                                        <option key={category} value={category}>
                                            {category}
                                        </option>
                                    ))}
                                </select>
                                <label htmlFor="new-target-date">
                                    Target month <span className="optional">optional</span>
                                </label>
                                <input
                                    id="new-target-date"
                                    type="month"
                                    value={targetDate}
                                    disabled={busy}
                                    onChange={(event) => setTargetDate(event.target.value)}
                                />
                            </React.Fragment>
                        )}
                        <label htmlFor="new-name">Name</label>
                        <input
                            id="new-name"
                            autoFocus
                            required
                            maxLength={200}
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            disabled={busy}
                        />
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
                        <LabelPicker
                            labels={labels}
                            value={labelIds}
                            onChange={setLabelIds}
                            disabled={busy}
                        />
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
                        {kind === 'delete'
                            ? deleteParent
                                ? 'Remove connection'
                                : `Delete ${label}`
                            : `Create ${label}`}
                    </button>
                </div>
            </form>
        </dialog>
    );
}
