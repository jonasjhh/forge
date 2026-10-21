import React, { useEffect, useRef, useState } from 'react';
import {
    ArrowRight,
    Check,
    Folder,
    Target,
    Gauge,
    Compass,
    GitBranch,
    ListTree,
    List,
    LoaderCircle,
    Maximize2,
    Network,
    Plus,
    RefreshCw,
    Search,
    Trash2,
    X,
    ZoomIn,
    ZoomOut
} from 'lucide-react';
import ItemGraph from './ItemGraph';
import GoalList from './GoalList';
import { AssigneePicker, MetricFields } from './EntryFields';
import { canConnect, canContain, entryTypes, moveGoalToFolder, normalizeEntry } from './entries';
import './App.css';

const isPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const previewKey = 'compass-preview-v1';

async function callWorkspace(operation, payload) {
    if (!isPreview) {
        const { invoke } = await import('@forge/bridge');
        return invoke(operation, payload);
    }
    if (operation === 'getGraph') {
        const graph = JSON.parse(
            localStorage.getItem(previewKey) || '{"items":[],"updatedAt":null}'
        );
        return { ...graph, items: graph.items.map(normalizeEntry) };
    }
    const graph = { items: payload.items, updatedAt: new Date().toISOString() };
    localStorage.setItem(previewKey, JSON.stringify(graph));
    return graph;
}

function IconButton({ label, children, ...props }) {
    return (
        <button type="button" className="icon-button" title={label} aria-label={label} {...props}>
            {children}
        </button>
    );
}

function ItemDetails({ item, items, busy, onSave, onSelect, onDelete, onCreate, onRelate }) {
    const [name, setName] = useState(item.name);
    const [description, setDescription] = useState(item.description);
    const [assignees, setAssignees] = useState(item.assignees);
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
        setMetric({
            currentValue: item.currentValue ?? null,
            targetValue: item.targetValue ?? null,
            unit: item.unit || ''
        });
        setTarget('');
        setParentTarget('');
    }, [item]);

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
        ...(item.type === 'metric' ? metric : {})
    };
    const changed = JSON.stringify(draft) !== JSON.stringify(item);
    const typeLabel =
        item.type === 'goal' && parents.some((parent) => parent.type === 'goal')
            ? 'Sub-goal'
            : entryTypes[item.type].label;

    return (
        <aside className="details" aria-label={`${typeLabel} details`}>
            <div className="panel-heading">
                <span className={`type-badge type-${item.type}`}>{typeLabel}</span>
                <IconButton
                    label={`Delete ${entryTypes[item.type].label.toLowerCase()}`}
                    disabled={busy}
                    onClick={onDelete}
                >
                    <Trash2 size={17} />
                </IconButton>
            </div>
            <form
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
                    maxLength={80}
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
                {item.type === 'metric' && (
                    <MetricFields
                        value={metric}
                        onChange={setMetric}
                        disabled={busy}
                        prefix="edit-metric"
                    />
                )}
                {item.type !== 'folder' && (
                    <AssigneePicker
                        value={assignees}
                        onChange={setAssignees}
                        disabled={busy}
                        id="edit-assignees"
                    />
                )}
                <button
                    className="button secondary save-button"
                    type="submit"
                    disabled={busy || !name.trim() || !changed}
                >
                    <Check size={16} />
                    Save changes
                </button>
            </form>
            {item.type !== 'metric' && (
                <section className="relationships" aria-labelledby="children-heading">
                    <h2 id="children-heading">
                        {item.type === 'goal' ? 'Sub-goals and metrics' : 'Contents'}{' '}
                        <span className="count">{item.childIds.length}</span>
                    </h2>
                    <div className="add-child-actions">
                        {item.type === 'folder' && (
                            <button
                                type="button"
                                className="button secondary"
                                disabled={busy}
                                onClick={() => onCreate('folder')}
                            >
                                <Folder size={15} />
                                Add folder
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
        </aside>
    );
}

function ItemDialog({
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
}) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState(initialType);
    const [parentId, setParentId] = useState(initialParentId);
    const [assignees, setAssignees] = useState([]);
    const [metric, setMetric] = useState({ currentValue: 0, targetValue: 100, unit: '' });
    const parentOptions = items.filter((candidate) => canContain(candidate.type, type));
    const validParentId = parentOptions.some((candidate) => candidate.id === parentId)
        ? parentId
        : '';
    const label = entryTypes[kind === 'delete' ? item.type : type].label.toLowerCase();
    const dialog = useRef(null);
    useEffect(() => {
        const element = dialog.current;
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
                                assignees: type === 'folder' ? [] : assignees,
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
                        Delete <strong>{item.name}</strong> and its connections? Its contents will
                        remain in the workspace.
                    </p>
                ) : (
                    <React.Fragment>
                        <label htmlFor="new-type">Type</label>
                        <select
                            id="new-type"
                            value={type}
                            disabled={busy}
                            onChange={(event) => setType(event.target.value)}
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
                                : type === 'folder'
                                  ? 'Inside'
                                  : 'Folder or parent goal'}
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
                                    : type === 'folder'
                                      ? 'Workspace root'
                                      : 'No folder or parent goal'}
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
                        {type !== 'folder' && (
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

function App() {
    const [items, setItems] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [search, setSearch] = useState('');
    const [mode, setMode] = useState('list');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [updatedAt, setUpdatedAt] = useState(null);
    const [dialog, setDialog] = useState(null);
    const [createType, setCreateType] = useState('folder');
    const [createParentId, setCreateParentId] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [reload, setReload] = useState(0);
    const graph = useRef(null);
    const saving = useRef(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError('');
        callWorkspace('getGraph')
            .then((data) => {
                if (cancelled) return;
                setItems(data.items);
                setUpdatedAt(data.updatedAt);
                setSelectedId((current) =>
                    data.items.some((item) => item.id === current) ? current : null
                );
            })
            .catch(() => {
                if (!cancelled)
                    setError(
                        'Could not load your workspace. Try refreshing. After enabling storage, deploy and upgrade the Jira installation.'
                    );
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [reload]);

    async function save(nextItems) {
        if (saving.current) return false;
        saving.current = true;
        setBusy(true);
        setError('');
        try {
            const data = await callWorkspace('saveGraph', { items: nextItems });
            setItems(data.items);
            setUpdatedAt(data.updatedAt);
            return true;
        } catch (failure) {
            setError(
                'Could not confirm your changes were saved. Try again or refresh the workspace.'
            );
            return false;
        } finally {
            saving.current = false;
            setBusy(false);
        }
    }

    const selected = items.find((item) => item.id === selectedId);
    const visibleItems = items.filter(
        (item) =>
            (typeFilter === 'all' || item.type === typeFilter) &&
            `${item.name} ${item.description} ${item.assignees.map((user) => user.displayName).join(' ')}`
                .toLowerCase()
                .includes(search.toLowerCase())
    );
    const relationshipItems = items.filter((item) => item.type !== 'folder');
    const connections = relationshipItems.reduce((total, item) => total + item.childIds.length, 0);

    function openCreate(type, parentId = '') {
        setCreateType(type);
        setCreateParentId(parentId);
        setDialog('create');
    }

    return (
        <main className="app">
            <header className="app-header">
                <div className="brand">
                    <span className="brand-mark">
                        <Compass size={25} strokeWidth={1.7} />
                    </span>
                    <div>
                        <h1>Compass</h1>
                        <span className="workspace-label">
                            {isPreview ? 'LOCAL PREVIEW' : 'SHARED WORKSPACE'}
                        </span>
                    </div>
                </div>
                <div className="header-actions">
                    <span className="save-status" role="status">
                        {busy ? (
                            <React.Fragment>
                                <LoaderCircle size={14} className="spin" />
                                Saving
                            </React.Fragment>
                        ) : updatedAt ? (
                            <React.Fragment>
                                <Check size={14} />
                                Saved
                            </React.Fragment>
                        ) : null}
                    </span>
                    <button
                        className="button secondary"
                        disabled={
                            loading || busy || items.length >= 100 || Boolean(error && !updatedAt)
                        }
                        onClick={() => openCreate('folder')}
                    >
                        <Plus size={17} />
                        New folder
                    </button>
                    <button
                        className="button primary"
                        disabled={
                            loading || busy || items.length >= 100 || Boolean(error && !updatedAt)
                        }
                        onClick={() =>
                            openCreate('goal', selected?.type === 'folder' ? selected.id : '')
                        }
                    >
                        <Plus size={17} />
                        New goal
                    </button>
                </div>
            </header>
            {error && (
                <div className="error-banner" role="alert">
                    <span>{error}</span>
                    <button
                        className="button secondary"
                        disabled={busy || loading}
                        onClick={() => setReload((value) => value + 1)}
                    >
                        <RefreshCw size={15} />
                        Refresh
                    </button>
                </div>
            )}
            <div className={`workspace ${selected ? 'has-selection' : ''} mode-${mode}`}>
                <section className="graph-workspace" aria-label="Goals workspace">
                    <div className="graph-toolbar">
                        <div className="view-switch" role="group" aria-label="Layout">
                            <button
                                type="button"
                                aria-pressed={mode === 'list'}
                                onClick={() => setMode('list')}
                            >
                                <List size={16} />
                                List
                            </button>
                            <button
                                type="button"
                                aria-pressed={mode === 'graph'}
                                onClick={() => setMode('graph')}
                            >
                                <Network size={16} />
                                Graph
                            </button>
                            <button
                                type="button"
                                aria-pressed={mode === 'tree'}
                                onClick={() => setMode('tree')}
                            >
                                <ListTree size={16} />
                                Tree
                            </button>
                        </div>
                        <div className="view-toolbar-actions">
                            <span className="connection-count">
                                {mode === 'list'
                                    ? `${visibleItems.length} entries`
                                    : `${connections} relationships`}
                            </span>
                            <IconButton
                                label="Refresh workspace"
                                disabled={loading || busy}
                                onClick={() => setReload((value) => value + 1)}
                            >
                                <RefreshCw size={16} className={loading ? 'spin' : ''} />
                            </IconButton>
                        </div>
                    </div>
                    {mode === 'list' ? (
                        <div className="list-workspace">
                            <div className="list-heading">
                                <h2>Goals</h2>
                                <div className="list-filters">
                                    <div className="search-field">
                                        <Search size={16} />
                                        <input
                                            aria-label="Search goals"
                                            type="search"
                                            placeholder="Search goals or assignees"
                                            value={search}
                                            onChange={(event) => setSearch(event.target.value)}
                                        />
                                    </div>
                                    <select
                                        aria-label="Filter by type"
                                        value={typeFilter}
                                        onChange={(event) => setTypeFilter(event.target.value)}
                                    >
                                        <option value="all">All types</option>
                                        <option value="folder">Folders</option>
                                        <option value="goal">Goals</option>
                                        <option value="metric">Metrics</option>
                                    </select>
                                </div>
                            </div>
                            {loading ? (
                                <div className="list-empty" role="status">
                                    <LoaderCircle size={24} className="spin" />
                                    Loading goals
                                </div>
                            ) : (
                                <GoalList
                                    items={items}
                                    entries={visibleItems}
                                    selectedId={selectedId}
                                    busy={busy}
                                    onSelect={setSelectedId}
                                    onMove={(goalId, folderId) =>
                                        save(moveGoalToFolder(items, goalId, folderId))
                                    }
                                />
                            )}
                        </div>
                    ) : (
                        <React.Fragment>
                            <div className="graph-surface">
                                {loading ? (
                                    <div className="empty-state" role="status">
                                        <LoaderCircle size={28} className="spin" />
                                        <h2>Loading workspace</h2>
                                    </div>
                                ) : relationshipItems.length ? (
                                    <ItemGraph
                                        ref={graph}
                                        items={items}
                                        selectedId={selectedId}
                                        mode={mode}
                                        onSelect={setSelectedId}
                                    />
                                ) : (
                                    <div className="empty-state">
                                        <span className="empty-symbol">
                                            <GitBranch size={42} strokeWidth={1.2} />
                                        </span>
                                        <h2>No goals yet</h2>
                                        <button
                                            className="button secondary"
                                            disabled={Boolean(error)}
                                            onClick={() => openCreate('goal')}
                                        >
                                            <Plus size={16} />
                                            New goal
                                        </button>
                                    </div>
                                )}
                                {relationshipItems.length > 0 && !loading && (
                                    <div className="graph-controls">
                                        <IconButton
                                            label="Zoom in"
                                            onClick={() => graph.current.zoom(1.2)}
                                        >
                                            <ZoomIn size={18} />
                                        </IconButton>
                                        <IconButton
                                            label="Zoom out"
                                            onClick={() => graph.current.zoom(1 / 1.2)}
                                        >
                                            <ZoomOut size={18} />
                                        </IconButton>
                                        <IconButton
                                            label="Fit graph"
                                            onClick={() => graph.current.fit()}
                                        >
                                            <Maximize2 size={17} />
                                        </IconButton>
                                    </div>
                                )}
                            </div>
                            <div className="graph-footer">
                                <span>
                                    <span className="legend-goal" />
                                    Goal
                                </span>
                                <span>
                                    <span className="legend-metric" />
                                    Metric
                                </span>
                            </div>
                        </React.Fragment>
                    )}
                </section>
                {selected && (
                    <ItemDetails
                        key={selected.id}
                        item={selected}
                        items={items}
                        busy={busy || loading}
                        onSave={(updated) =>
                            save(items.map((item) => (item.id === updated.id ? updated : item)))
                        }
                        onSelect={setSelectedId}
                        onDelete={() => setDialog('delete')}
                        onCreate={(type) => openCreate(type, selected.id)}
                        onRelate={(parentId, childId, add) =>
                            save(
                                items.map((entry) =>
                                    entry.id === parentId
                                        ? {
                                              ...entry,
                                              childIds: add
                                                  ? [...entry.childIds, childId]
                                                  : entry.childIds.filter((id) => id !== childId)
                                          }
                                        : entry
                                )
                            )
                        }
                    />
                )}
            </div>
            {dialog && (dialog !== 'delete' || selected) && (
                <ItemDialog
                    key={dialog}
                    kind={dialog}
                    item={selected}
                    items={items}
                    initialType={createType}
                    initialParentId={createParentId}
                    busy={busy}
                    error={error}
                    onClose={() => setDialog(null)}
                    onCreate={async (draft, parentId) => {
                        const item = {
                            ...draft,
                            id: window.crypto.randomUUID(),
                            name: draft.name.trim(),
                            description: draft.description.trim(),
                            childIds: []
                        };
                        const nextItems = items.map((entry) =>
                            entry.id === parentId
                                ? { ...entry, childIds: [...entry.childIds, item.id] }
                                : entry
                        );
                        if (await save([...nextItems, item])) {
                            setSelectedId(item.id);
                            if (item.type === 'folder') {
                                setMode('list');
                            }
                            setDialog(null);
                        }
                    }}
                    onDelete={async () => {
                        if (
                            await save(
                                items
                                    .filter((item) => item.id !== selected.id)
                                    .map((item) => ({
                                        ...item,
                                        childIds: item.childIds.filter((id) => id !== selected.id)
                                    }))
                            )
                        ) {
                            setSelectedId(null);
                            setDialog(null);
                        }
                    }}
                />
            )}
        </main>
    );
}

export default App;
