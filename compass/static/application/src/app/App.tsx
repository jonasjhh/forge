import React, { useEffect, useRef, useState } from 'react';
import {
    Check,
    Folder,
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
    ZoomIn,
    ZoomOut
} from 'lucide-react';
import IconButton from '../components/ui/IconButton';
import AssigneeFilter from '../components/assignees/AssigneeFilter';
import EntryDetails from '../features/workspace/components/EntryDetails';
import EntryDialog from '../features/workspace/components/EntryDialog';
import GoalList from '../features/workspace/components/GoalList';
import ItemGraph from '../features/workspace/components/ItemGraph';
import {
    matchesAssignees,
    moveGoalToFolder,
    moveListEntry
} from '../features/workspace/model/entries';
import { callWorkspace, isPreview } from '../services/workspace';
import type { Assignee, EntryType, ViewMode, WorkspaceEntry } from '../types/workspace';
import type { GraphHandle } from '../features/workspace/components/ItemGraph';
import './App.css';
function App() {
    const [items, setItems] = useState<WorkspaceEntry[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [mode, setMode] = useState<ViewMode>('list');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);
    const [dialog, setDialog] = useState<'create' | 'delete' | null>(null);
    const [createType, setCreateType] = useState<EntryType>('folder');
    const [createParentId, setCreateParentId] = useState('');
    const [typeFilter, setTypeFilter] = useState<EntryType | 'all'>('all');
    const [assigneeFilter, setAssigneeFilter] = useState<Assignee[]>([]);
    const [reload, setReload] = useState(0);
    const graph = useRef<GraphHandle>(null);
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

    async function save(nextItems: WorkspaceEntry[]): Promise<boolean> {
        if (saving.current) return false;
        saving.current = true;
        setBusy(true);
        setError('');
        try {
            const data = await callWorkspace('saveGraph', { items: nextItems });
            setItems(data.items);
            setUpdatedAt(data.updatedAt);
            return true;
        } catch {
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
            matchesAssignees(item, assigneeFilter) &&
            `${item.name} ${item.description} ${item.assignees.map((user) => user.displayName).join(' ')}`
                .toLowerCase()
                .includes(search.toLowerCase())
    );
    const relationshipItems = items.filter((item) => item.type !== 'folder');
    const filtered = assigneeFilter.length > 0 || typeFilter !== 'all' || search.length > 0;
    const listCountLabel = `${visibleItems.length} ${filtered ? (visibleItems.length === 1 ? 'match' : 'matches') : visibleItems.length === 1 ? 'entry' : 'entries'}`;
    const connections = relationshipItems.reduce((total, item) => total + item.childIds.length, 0);
    const workspaceAssignees = [
        ...new Map(
            items.flatMap((item) => item.assignees).map((user) => [user.accountId, user])
        ).values()
    ].sort((first, second) => first.displayName.localeCompare(second.displayName));

    function openCreate(type: EntryType, parentId = ''): void {
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
                            {isPreview ? 'Local preview' : 'Shared workspace'}
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
                        <Folder size={17} />
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
                                {mode === 'list' ? listCountLabel : `${connections} relationships`}
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
                                        onChange={(event) =>
                                            setTypeFilter(event.target.value as EntryType | 'all')
                                        }
                                    >
                                        <option value="all">All types</option>
                                        <option value="folder">Folders</option>
                                        <option value="goal">Goals</option>
                                        <option value="metric">Metrics</option>
                                    </select>
                                    <AssigneeFilter
                                        users={workspaceAssignees}
                                        value={assigneeFilter}
                                        onChange={setAssigneeFilter}
                                    />
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
                                    onRearrange={(sourcePath, targetPath, placement) =>
                                        save(
                                            moveListEntry(items, sourcePath, targetPath, placement)
                                        )
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
                                            onClick={() => graph.current?.zoom(1.2)}
                                        >
                                            <ZoomIn size={18} />
                                        </IconButton>
                                        <IconButton
                                            label="Zoom out"
                                            onClick={() => graph.current?.zoom(1 / 1.2)}
                                        >
                                            <ZoomOut size={18} />
                                        </IconButton>
                                        <IconButton
                                            label="Fit graph"
                                            onClick={() => graph.current?.fit()}
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
                    <EntryDetails
                        key={selected.id}
                        item={selected}
                        items={items}
                        busy={busy || loading}
                        onSave={(updated, folderId) => {
                            const nextItems = items.map((item) =>
                                item.id === updated.id ? updated : item
                            );
                            return save(
                                folderId === undefined
                                    ? nextItems
                                    : moveGoalToFolder(nextItems, updated.id, folderId)
                            );
                        }}
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
                <EntryDialog
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
                        const item: WorkspaceEntry = {
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
                        if (!selected) return;
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
