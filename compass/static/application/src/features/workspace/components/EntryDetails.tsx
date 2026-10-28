import React, { useEffect, useState } from 'react';
import {
    ArrowRight,
    Check,
    Folder as GroupIcon,
    Target,
    Gauge,
    GitBranch,
    Layers,
    Rocket,
    Plus,
    Trash2,
    X
} from 'lucide-react';
import IconButton from '../../../components/ui/IconButton';
import AssigneePicker from '../../../components/assignees/AssigneePicker';
import LabelPicker from '../../../components/labels/LabelPicker';
import LabelChip from '../../../components/labels/LabelChip';
import MetricFields from './MetricFields';
import { canConnect, entryTypes, goalCategories } from '../model/entries';
import type {
    EntryType,
    GoalCategory,
    WorkspaceEntry,
    WorkspaceLabel
} from '../../../types/workspace';

const goalCategoryIcons = {
    Decision: GitBranch,
    Capability: Layers,
    Delivery: Rocket
};

interface EntryDetailsProps {
    item: WorkspaceEntry;
    items: WorkspaceEntry[];
    labels: WorkspaceLabel[];
    busy: boolean;
    onSave: (entry: WorkspaceEntry, groupId?: string) => Promise<boolean>;
    onSelect: (id: string) => void;
    onClose: () => void;
    onDelete: () => void;
    onCreate: (type: EntryType) => void;
    onRelate: (parentId: string, childId: string, add: boolean) => Promise<boolean>;
}
export default function EntryDetails({
    item,
    items,
    labels,
    busy,
    onSave: saveEntry,
    onSelect,
    onClose,
    onDelete,
    onCreate,
    onRelate
}: EntryDetailsProps) {
    const currentGroupId =
        items.find((entry) => entry.type === 'group' && entry.childIds.includes(item.id))?.id || '';
    const [groupId, setGroupId] = useState(currentGroupId);
    const [name, setName] = useState(item.name);
    const [description, setDescription] = useState(item.description);
    const [assignees, setAssignees] = useState(item.assignees);
    const [labelIds, setLabelIds] = useState(item.labelIds ?? []);
    const [goalCategory, setGoalCategory] = useState<GoalCategory>(item.goalCategory ?? 'Delivery');
    const [metric, setMetric] = useState({
        currentValue: item.currentValue ?? null,
        targetValue: item.targetValue ?? null,
        unit: item.unit || ''
    });
    const [target, setTarget] = useState('');
    const [parentTarget, setParentTarget] = useState('');
    useEffect(() => {
        setName(item.name);
        setDescription(item.description);
        setAssignees(item.assignees);
        setLabelIds(item.labelIds ?? []);
        setGoalCategory(item.goalCategory ?? 'Delivery');
        setMetric({
            currentValue: item.currentValue ?? null,
            targetValue: item.targetValue ?? null,
            unit: item.unit || ''
        });
        setTarget('');
        setParentTarget('');
        setGroupId(currentGroupId);
    }, [item, currentGroupId]);

    function onSave(updated: WorkspaceEntry): Promise<boolean> {
        return saveEntry(
            updated,
            item.type === 'goal' && groupId !== currentGroupId ? groupId : undefined
        );
    }

    const candidates = items.filter((candidate) => canConnect(items, item, candidate));
    const parents = items.filter(
        (candidate) =>
            candidate.childIds.includes(item.id) &&
            (item.type !== 'goal' || candidate.type === 'goal')
    );
    const parentCandidates = items.filter(
        (candidate) => candidate.type === 'goal' && canConnect(items, candidate, item)
    );
    const draft = {
        ...item,
        name,
        description,
        assignees,
        labelIds,
        ...(item.type === 'goal' ? { goalCategory } : {}),
        ...(item.type === 'metric' ? metric : {})
    };
    const changed = JSON.stringify(draft) !== JSON.stringify(item) || groupId !== currentGroupId;
    const typeLabel =
        item.type === 'goal' && parents.some((parent) => parent.type === 'goal')
            ? 'Sub-goal'
            : entryTypes[item.type].label;
    const GoalCategoryIcon = goalCategoryIcons[goalCategory];
    const saveButton = (
        <button
            className="button secondary save-button"
            type="submit"
            form="entry-edit-form"
            disabled={busy || !name.trim() || !changed}
        >
            <Check size={16} />
            Save changes
        </button>
    );

    return (
        <aside className="details" aria-label={`${typeLabel} details`}>
            <div className="panel-heading">
                <span className={`type-badge type-${item.type}`}>
                    {item.type === 'goal' && <GoalCategoryIcon size={14} aria-hidden="true" />}
                    {typeLabel}
                </span>
                <div className="row-actions">
                    <IconButton
                        label={`Delete ${entryTypes[item.type].label.toLowerCase()}`}
                        disabled={busy}
                        onClick={onDelete}
                    >
                        <Trash2 size={17} />
                    </IconButton>
                    <IconButton label="Close sidebar" onClick={onClose}>
                        <X size={17} />
                    </IconButton>
                </div>
            </div>
            <div className="details-save-actions">{saveButton}</div>
            <form
                id="entry-edit-form"
                onSubmit={(event) => {
                    event.preventDefault();
                    onSave(draft);
                }}
            >
                <label htmlFor="item-name">Name</label>
                <input
                    id="item-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    maxLength={200}
                    disabled={busy}
                />
                <label htmlFor="item-description">
                    Description <span className="optional">optional</span>
                </label>
                <textarea
                    id="item-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={4}
                    maxLength={500}
                    disabled={busy}
                />
                <LabelPicker
                    labels={labels}
                    value={labelIds}
                    onChange={setLabelIds}
                    disabled={busy}
                />
                {item.type === 'goal' && (
                    <React.Fragment>
                        <label htmlFor="goal-category">Goal type</label>
                        <select
                            id="goal-category"
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
                        <label htmlFor="goal-group">Group</label>
                        <select
                            id="goal-group"
                            value={groupId}
                            disabled={busy}
                            onChange={(event) => setGroupId(event.target.value)}
                        >
                            <option value="">No direct group</option>
                            {items
                                .filter((entry) => entry.type === 'group')
                                .map((group) => (
                                    <option key={group.id} value={group.id}>
                                        {group.name}
                                    </option>
                                ))}
                        </select>
                    </React.Fragment>
                )}
                {item.type === 'metric' && (
                    <MetricFields
                        value={metric}
                        onChange={setMetric}
                        disabled={busy}
                        prefix="edit-metric"
                    />
                )}
                {item.type !== 'group' && (
                    <AssigneePicker
                        value={assignees}
                        onChange={setAssignees}
                        disabled={busy}
                        id="edit-assignees"
                    />
                )}
            </form>
            {item.type !== 'metric' && (
                <section className="relationships" aria-labelledby="children-heading">
                    <h2 id="children-heading">
                        {item.type === 'goal' ? 'Sub-goals and metrics' : 'Contents'}{' '}
                        <span className="count">{item.childIds.length}</span>
                    </h2>
                    <div className="add-child-actions">
                        {item.type === 'group' && (
                            <button
                                type="button"
                                className="button secondary"
                                disabled={busy}
                                onClick={() => onCreate('group')}
                            >
                                <GroupIcon size={15} />
                                Add group
                            </button>
                        )}
                        <button
                            type="button"
                            className="button secondary"
                            disabled={busy}
                            onClick={() => onCreate('goal')}
                        >
                            <Target size={15} />
                            {item.type === 'goal' ? 'Add sub-goal' : 'Add goal'}
                        </button>
                        {item.type === 'goal' && (
                            <button
                                type="button"
                                className="button secondary"
                                disabled={busy}
                                onClick={() => onCreate('metric')}
                            >
                                <Gauge size={15} />
                                Add metric
                            </button>
                        )}
                    </div>
                    {item.childIds.length === 0 && <p className="muted">No contents yet.</p>}
                    <ul className="relationship-list">
                        {item.childIds.map((childId) => {
                            const child = items.find((candidate) => candidate.id === childId);
                            if (!child) return null;
                            return (
                                <li key={childId}>
                                    <button
                                        type="button"
                                        className="relationship-link"
                                        onClick={() => onSelect(childId)}
                                    >
                                        <ArrowRight size={15} />
                                        <span>{child.name}</span>
                                    </button>
                                    <IconButton
                                        label={`Remove ${child.name} from ${item.name}`}
                                        disabled={busy || !name.trim()}
                                        onClick={() =>
                                            onSave({
                                                ...draft,
                                                childIds: item.childIds.filter(
                                                    (id) => id !== childId
                                                )
                                            })
                                        }
                                    >
                                        <X size={15} />
                                    </IconButton>
                                </li>
                            );
                        })}
                    </ul>
                    <form
                        className="connect-form"
                        onSubmit={async (event) => {
                            event.preventDefault();
                            if (
                                target &&
                                (await onSave({ ...draft, childIds: [...item.childIds, target] }))
                            )
                                setTarget('');
                        }}
                    >
                        <label htmlFor="connect-item">Add existing</label>
                        <div className="connect-row">
                            <select
                                id="connect-item"
                                value={target}
                                onChange={(event) => setTarget(event.target.value)}
                                disabled={busy || !candidates.length}
                            >
                                <option value="">
                                    {candidates.length ? 'Select an entry' : 'No available entries'}
                                </option>
                                {candidates.map((candidate) => (
                                    <option key={candidate.id} value={candidate.id}>
                                        {candidate.name} ({entryTypes[candidate.type].label})
                                    </option>
                                ))}
                            </select>
                            <button
                                className="icon-button connect-button"
                                type="submit"
                                title="Add existing entry"
                                aria-label="Add existing entry"
                                disabled={busy || !target || !name.trim()}
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                    </form>
                </section>
            )}
            {labelIds.length > 0 && (
                <section className="relationships" aria-label="Assigned labels">
                    <h2>Labels</h2>
                    <div className="entry-label-list">
                        {labelIds.map((id) => {
                            const label = labels.find((candidate) => candidate.id === id);
                            return label ? <LabelChip key={label.id} label={label} /> : null;
                        })}
                    </div>
                </section>
            )}
            <section className="relationships" aria-labelledby="parents-heading">
                <h2 id="parents-heading">
                    {item.type === 'goal' ? 'Parent goals' : 'Inside'}{' '}
                    <span className="count">{parents.length}</span>
                </h2>
                {!parents.length && (
                    <p className="muted">
                        {item.type === 'goal' ? 'No parent goals' : 'Workspace root'}
                    </p>
                )}
                <ul className="relationship-list">
                    {parents.map((parent) => (
                        <li key={parent.id}>
                            <button
                                type="button"
                                className="relationship-link"
                                onClick={() => onSelect(parent.id)}
                            >
                                <GitBranch size={15} />
                                <span>{parent.name}</span>
                            </button>
                            {item.type === 'goal' && (
                                <IconButton
                                    label={`Unlink parent ${parent.name}`}
                                    disabled={busy}
                                    onClick={() => onRelate(parent.id, item.id, false)}
                                >
                                    <X size={15} />
                                </IconButton>
                            )}
                        </li>
                    ))}
                </ul>
                {item.type === 'goal' && (
                    <form
                        className="connect-form"
                        onSubmit={async (event) => {
                            event.preventDefault();
                            if (parentTarget && (await onRelate(parentTarget, item.id, true)))
                                setParentTarget('');
                        }}
                    >
                        <label htmlFor="parent-goal">Link parent goal</label>
                        <div className="connect-row">
                            <select
                                id="parent-goal"
                                value={parentTarget}
                                onChange={(event) => setParentTarget(event.target.value)}
                                disabled={busy || !parentCandidates.length}
                            >
                                <option value="">
                                    {parentCandidates.length
                                        ? 'Select a goal'
                                        : 'No available goals'}
                                </option>
                                {parentCandidates.map((parent) => (
                                    <option key={parent.id} value={parent.id}>
                                        {parent.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                className="icon-button connect-button"
                                type="submit"
                                title="Link parent goal"
                                aria-label="Link parent goal"
                                disabled={busy || !parentTarget}
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                    </form>
                )}
            </section>
            <div className="details-save-actions">{saveButton}</div>
        </aside>
    );
}
