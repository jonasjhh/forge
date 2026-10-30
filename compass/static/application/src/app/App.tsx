import React, { useEffect, useRef, useState } from 'react';
import {
    Check,
    ChevronDown,
    ChevronUp,
    Filter,
    Folder as GroupIcon,
    Compass,
    GitBranch,
    GripVertical,
    LayoutDashboard,
    ListTree,
    List,
    LoaderCircle,
    Maximize2,
    Network,
    Plus,
    RefreshCw,
    Search,
    Tags,
    X,
    ZoomIn,
    ZoomOut
} from 'lucide-react';
import IconButton from '../components/ui/IconButton';
import CheckboxDropdown from '../components/ui/CheckboxDropdown';
import LabelPicker from '../components/labels/LabelPicker';
import AssigneeFilter from '../components/assignees/AssigneeFilter';
import EntryDetails from '../features/workspace/components/EntryDetails';
import EntryDialog from '../features/workspace/components/EntryDialog';
import GoalList from '../features/workspace/components/GoalList';
import CardsView from '../features/workspace/components/CardsView';
import ItemGraph from '../features/workspace/components/ItemGraph';
import LabelManager from '../features/workspace/components/LabelManager';
import WorkspaceTransfer from '../features/workspace/components/WorkspaceTransfer';
import {
    entryTypes,
    connectedEntries,
    goalCategories,
    linkListEntry,
    matchesAssignees,
    moveGoalToGroup,
    moveListEntry
} from '../features/workspace/model/entries';
import { callWorkspace, isPreview } from '../services/workspace';
import type {
    Assignee,
    EntryType,
    GoalCategory,
    ViewMode,
    WorkspaceEntry,
    WorkspaceLabel
} from '../types/workspace';
import type { GraphHandle } from '../features/workspace/components/ItemGraph';
import './App.css';

type TypeFilter = Exclude<EntryType, 'goal'> | GoalCategory;
type RelationshipViewMode = Extract<ViewMode, 'graph' | 'tree'>;
const MAX_WORKSPACE_ITEMS = 500;

const typeOptions: { value: TypeFilter; label: string }[] = [
    { value: 'group', label: entryTypes.group.plural },
    ...goalCategories.map((category) => ({ value: category, label: category })),
    { value: 'metric', label: entryTypes.metric.plural }
];

function App() {
    const [items, setItems] = useState<WorkspaceEntry[]>([]);
    const [labels, setLabels] = useState<WorkspaceLabel[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
    const [focusByView, setFocusByView] = useState<Record<RelationshipViewMode, string | null>>({
        graph: null,
        tree: null
    });
    const [sidebarWidth, setSidebarWidth] = useState(320);
    const workspaceRef = useRef<HTMLDivElement>(null);
    const sidebarResize = useRef<{ startX: number; width: number } | null>(null);
    const [search, setSearch] = useState('');
    const [mode, setMode] = useState<ViewMode>('list');
    const [toolbarExpanded, setToolbarExpanded] = useState(() => {
        try {
            return localStorage.getItem('compass-toolbar-expanded') !== 'false';
        } catch {
            return true;
        }
    });
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);
    const [dialog, setDialog] = useState<'create' | 'delete' | null>(null);
    const [deleteParentId, setDeleteParentId] = useState<string | null>(null);
    const [createType, setCreateType] = useState<EntryType>('group');
    const [createParentId, setCreateParentId] = useState('');
    const [typeFilter, setTypeFilter] = useState<TypeFilter[]>(() =>
        typeOptions.map((option) => option.value)
    );
    const [assigneeFilter, setAssigneeFilter] = useState<Assignee[]>([]);
    const [labelFilter, setLabelFilter] = useState<string[]>([]);
    const [reload, setReload] = useState(0);
    const graph = useRef<GraphHandle>(null);
    const saving = useRef(false);
    const deliveries = items.filter(
        (item) => item.type === 'goal' && (item.goalCategory ?? 'Delivery') === 'Delivery'
    );

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError('');
        callWorkspace('getGraph')
            .then((data) => {
                if (cancelled) return;
                setItems(data.items);
                setLabels(data.labels ?? []);
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

    useEffect(() => {
        const availableDeliveries = items.filter(
            (item) => item.type === 'goal' && (item.goalCategory ?? 'Delivery') === 'Delivery'
        );
        if (availableDeliveries.some((delivery) => delivery.id === selectedDeliveryId)) return;
        setSelectedDeliveryId(availableDeliveries[0]?.id ?? null);
    }, [items, selectedDeliveryId]);

    async function save(
        nextItems: WorkspaceEntry[],
        nextLabels: WorkspaceLabel[] = labels
    ): Promise<boolean> {
        if (saving.current) return false;
        saving.current = true;
        setBusy(true);
        setError('');
        try {
            const data = await callWorkspace('saveGraph', { items: nextItems, labels: nextLabels });
            setItems(data.items);
            setLabels(data.labels);
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
    const normalizedSearch = search.trim().toLowerCase();
    const matchingItems = items.filter((item) => {
        const assignedLabels = (item.labelIds ?? [])
            .map((id) => labels.find((label) => label.id === id)?.name)
            .filter(Boolean)
            .join(' ');
        const searchableText = [
            item.name,
            item.description,
            item.type === 'goal' ? (item.goalCategory ?? 'Delivery') : '',
            item.assignees.map((user) => user.displayName).join(' '),
            assignedLabels
        ]
            .join(' ')
            .toLowerCase();
        return (
            (item.type === 'goal'
                ? typeFilter.includes(item.goalCategory ?? 'Delivery')
                : typeFilter.includes(item.type)) &&
            matchesAssignees(item, assigneeFilter) &&
            (labelFilter.length === 0 ||
                (item.labelIds ?? []).some((id) => labelFilter.includes(id))) &&
            searchableText.includes(normalizedSearch)
        );
    });
    const focusForMode = mode === 'graph' || mode === 'tree' ? focusByView[mode] : null;
    const focusedId =
        focusForMode && items.some((item) => item.id === focusForMode) ? focusForMode : null;
    const graphItems = focusedId ? connectedEntries(items, focusedId) : items;
    const visibleItems = matchingItems;
    const relationshipItems = graphItems.filter((item) => item.type !== 'group');
    const filtered =
        assigneeFilter.length > 0 ||
        typeFilter.length !== typeOptions.length ||
        labelFilter.length > 0 ||
        search.length > 0;
    const activeFilterCount =
        Number(search.length > 0) +
        Number(typeFilter.length !== typeOptions.length) +
        Number(assigneeFilter.length > 0) +
        Number(labelFilter.length > 0);
    const listCountLabel = `${visibleItems.length} ${filtered ? (visibleItems.length === 1 ? 'match' : 'matches') : visibleItems.length === 1 ? 'entry' : 'entries'}`;
    const relationshipIds = new Set(relationshipItems.map((item) => item.id));
    const connections = relationshipItems.reduce(
        (total, item) =>
            total + item.childIds.filter((childId) => relationshipIds.has(childId)).length,
        0
    );
    const workspaceAssignees = [
        ...new Map(
            items.flatMap((item) => item.assignees).map((user) => [user.accountId, user])
        ).values()
    ].sort((first, second) => first.displayName.localeCompare(second.displayName));
    const workspaceFilters = (
        <div className="workspace-filters list-filters">
            <div className="search-field">
                <Search size={16} />
                <input
                    aria-label="Search workspace"
                    type="search"
                    placeholder="Search names, assignees, or labels"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                />
            </div>
            <CheckboxDropdown
                label="Filter by type"
                allLabel="All types"
                emptyLabel="No types"
                options={typeOptions}
                value={typeFilter}
                onChange={setTypeFilter}
            />
            <AssigneeFilter
                users={workspaceAssignees}
                value={assigneeFilter}
                onChange={setAssigneeFilter}
            />
            <LabelPicker
                labels={labels}
                value={labelFilter}
                onChange={setLabelFilter}
                label="Filter by label"
            />
            {filtered && (
                <IconButton
                    label="Clear filters"
                    onClick={() => {
                        setSearch('');
                        setTypeFilter(typeOptions.map((option) => option.value));
                        setAssigneeFilter([]);
                        setLabelFilter([]);
                    }}
                >
                    <X size={16} />
                </IconButton>
            )}
        </div>
    );

    function openCreate(type: EntryType, parentId = ''): void {
        setCreateType(type);
        setCreateParentId(parentId);
        setDialog('create');
    }

    function setToolbarVisibility(expanded: boolean): void {
        setToolbarExpanded(expanded);
        try {
            localStorage.setItem('compass-toolbar-expanded', String(expanded));
        } catch {
            return;
        }
    }

    const viewControls = (
        <div className="graph-toolbar">
            <div className="view-switch" role="group" aria-label="Layout">
                <button
                    type="button"
                    aria-label="List"
                    title="List"
                    aria-pressed={mode === 'list'}
                    onClick={() => setMode('list')}
                >
                    <List size={16} />
                    <span className="view-label">List</span>
                </button>
                <button
                    type="button"
                    aria-label="Cards"
                    title="Cards"
                    aria-pressed={mode === 'cards'}
                    onClick={() => setMode('cards')}
                >
                    <LayoutDashboard size={16} />
                    <span className="view-label">Cards</span>
                </button>
                <button
                    type="button"
                    aria-label="Graph"
                    title="Graph"
                    aria-pressed={mode === 'graph'}
                    onClick={() => setMode('graph')}
                >
                    <Network size={16} />
                    <span className="view-label">Graph</span>
                </button>
                <button
                    type="button"
                    aria-label="Tree"
                    title="Tree"
                    aria-pressed={mode === 'tree'}
                    onClick={() => setMode('tree')}
                >
                    <ListTree size={16} />
                    <span className="view-label">Tree</span>
                </button>
                <button
                    type="button"
                    aria-label="Labels"
                    title="Labels"
                    aria-pressed={mode === 'labels'}
                    onClick={() => setMode('labels')}
                >
                    <Tags size={16} />
                    <span className="view-label">Labels</span>
                </button>
            </div>
            <div className="view-toolbar-actions">
                {(mode === 'graph' || mode === 'tree') && focusedId && (
                    <IconButton
                        label={`Show full ${mode}`}
                        onClick={() => {
                            setFocusByView((current) => ({ ...current, [mode]: null }));
                            setSelectedId(null);
                        }}
                    >
                        <ListTree size={16} />
                    </IconButton>
                )}
                <span className="connection-count">
                    {mode === 'list'
                        ? listCountLabel
                        : mode === 'labels'
                          ? `${labels.length} labels`
                          : mode === 'cards'
                            ? `${deliveries.length} deliveries`
                            : `${relationshipItems.length} items · ${connections} relationships`}
                </span>
                {!toolbarExpanded && mode === 'list' && filtered && (
                    <button
                        type="button"
                        className="active-filter-indicator"
                        title={`Show ${activeFilterCount} active filters`}
                        aria-label={`Show ${activeFilterCount} active filters`}
                        onClick={() => setToolbarVisibility(true)}
                    >
                        <Filter size={14} />
                        <span>{activeFilterCount}</span>
                    </button>
                )}
                <IconButton
                    label="Refresh workspace"
                    disabled={loading || busy}
                    onClick={() => {
                        if (mode === 'graph' || mode === 'tree') {
                            setSelectedId(null);
                            setFocusByView((current) => ({ ...current, [mode]: null }));
                        }
                        setReload((value) => value + 1);
                    }}
                >
                    <RefreshCw size={16} className={loading ? 'spin' : ''} />
                </IconButton>
            </div>
        </div>
    );

    return (
        <main className="app">
            <header className="app-header">
                <div className="brand" title={isPreview ? 'Local preview' : 'Shared workspace'}>
                    <span className="brand-mark">
                        <Compass size={25} strokeWidth={1.7} />
                    </span>
                    <div>
                        <h1>Compass</h1>
                        <span className="workspace-label visually-hidden">
                            {isPreview ? 'Local preview' : 'Shared workspace'}
                        </span>
                    </div>
                </div>
                {viewControls}
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
                        className="button primary"
                        disabled={
                            loading ||
                            busy ||
                            items.length >= MAX_WORKSPACE_ITEMS ||
                            Boolean(error && !updatedAt)
                        }
                        onClick={() =>
                            openCreate('goal', selected?.type === 'group' ? selected.id : '')
                        }
                    >
                        <Plus size={17} />
                        New goal
                    </button>
                    <IconButton
                        label={toolbarExpanded ? 'Collapse toolbar' : 'Expand toolbar'}
                        aria-expanded={toolbarExpanded}
                        aria-controls="workspace-toolbar"
                        onClick={() => setToolbarVisibility(!toolbarExpanded)}
                    >
                        {toolbarExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </IconButton>
                </div>
            </header>
            <div id="workspace-toolbar" className="workspace-toolbar" hidden={!toolbarExpanded}>
                {mode === 'list' && workspaceFilters}
                <div className="toolbar-actions">
                    <WorkspaceTransfer
                        graph={{ items, labels }}
                        disabled={loading || busy}
                        onImport={async (imported) => {
                            const saved = await save(imported.items, imported.labels);
                            if (saved) {
                                setSelectedId(null);
                                setFocusByView({ graph: null, tree: null });
                                setDialog(null);
                                setSearch('');
                                setTypeFilter(typeOptions.map((option) => option.value));
                                setAssigneeFilter([]);
                                setLabelFilter([]);
                                setMode('list');
                            }
                            return saved;
                        }}
                    />
                    <button
                        className="button secondary"
                        disabled={
                            loading ||
                            busy ||
                            items.length >= MAX_WORKSPACE_ITEMS ||
                            Boolean(error && !updatedAt)
                        }
                        onClick={() => openCreate('group')}
                    >
                        <GroupIcon size={17} />
                        New group
                    </button>
                </div>
            </div>
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
            <div
                ref={workspaceRef}
                className={`workspace ${selected ? 'has-selection' : ''} mode-${mode}`}
                style={{ '--sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
            >
                {selected && (
                    <button
                        type="button"
                        className="sidebar-resizer"
                        role="separator"
                        aria-label="Resize edit sidebar"
                        aria-orientation="vertical"
                        aria-valuemin={280}
                        aria-valuemax={640}
                        aria-valuenow={sidebarWidth}
                        title="Resize edit sidebar"
                        onPointerDown={(event) => {
                            if (event.button !== 0) return;
                            event.preventDefault();
                            sidebarResize.current = {
                                startX: event.clientX,
                                width: Math.min(
                                    sidebarWidth,
                                    (workspaceRef.current?.getBoundingClientRect().width || 1280) /
                                        2
                                )
                            };
                            event.currentTarget.setPointerCapture(event.pointerId);
                        }}
                        onPointerMove={(event) => {
                            const gesture = sidebarResize.current;
                            if (!gesture) return;
                            const maximum = Math.min(
                                640,
                                (workspaceRef.current?.getBoundingClientRect().width || 1280) / 2
                            );
                            setSidebarWidth(
                                Math.max(
                                    280,
                                    Math.min(
                                        maximum,
                                        gesture.width + gesture.startX - event.clientX
                                    )
                                )
                            );
                        }}
                        onPointerUp={() => {
                            sidebarResize.current = null;
                        }}
                        onPointerCancel={() => {
                            sidebarResize.current = null;
                        }}
                        onLostPointerCapture={() => {
                            sidebarResize.current = null;
                        }}
                        onKeyDown={(event) => {
                            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                            event.preventDefault();
                            const maximum = Math.min(
                                640,
                                (workspaceRef.current?.getBoundingClientRect().width || 1280) / 2
                            );
                            const amount = event.key === 'ArrowLeft' ? 20 : -20;
                            setSidebarWidth((current) =>
                                Math.max(280, Math.min(maximum, current + amount))
                            );
                        }}
                    >
                        <GripVertical size={16} aria-hidden="true" />
                    </button>
                )}
                <section className="graph-workspace" aria-label="Goals workspace">
                    {mode === 'labels' ? (
                        <LabelManager
                            labels={labels}
                            busy={busy}
                            onSave={async (nextLabels) => {
                                const knownIds = new Set(nextLabels.map((label) => label.id));
                                const nextItems = items.map((entry) => ({
                                    ...entry,
                                    labelIds: (entry.labelIds ?? []).filter((id) =>
                                        knownIds.has(id)
                                    )
                                }));
                                const saved = await save(nextItems, nextLabels);
                                if (saved)
                                    setLabelFilter((current) =>
                                        current.filter((id) => knownIds.has(id))
                                    );
                                return saved;
                            }}
                        />
                    ) : mode === 'cards' ? (
                        <CardsView
                            items={items}
                            labels={labels}
                            selectedId={selectedDeliveryId}
                            onSelect={setSelectedDeliveryId}
                        />
                    ) : mode === 'list' ? (
                        <div className="list-workspace">
                            {loading ? (
                                <div className="list-empty" role="status">
                                    <LoaderCircle size={24} className="spin" />
                                    Loading goals
                                </div>
                            ) : (
                                <GoalList
                                    items={items}
                                    labels={labels}
                                    entries={visibleItems}
                                    selectedId={selectedId}
                                    busy={busy}
                                    onSelect={setSelectedId}
                                    onCreateGoal={(parentId) => openCreate('goal', parentId)}
                                    onLink={(sourceId, parentId) =>
                                        save(linkListEntry(items, sourceId, parentId))
                                    }
                                    onDelete={(path) => {
                                        const parts = path.split('/');
                                        const id = parts[parts.length - 1];
                                        const parentId = parts[parts.length - 2];
                                        const parents = items.filter((item) =>
                                            item.childIds.includes(id)
                                        );
                                        setDeleteParentId(
                                            parentId && parents.length > 1 ? parentId : null
                                        );
                                        setSelectedId(id);
                                        setDialog('delete');
                                    }}
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
                                        visibleIds={items.map((item) => item.id)}
                                        focusedIds={
                                            focusedId
                                                ? graphItems.map((item) => item.id)
                                                : undefined
                                        }
                                        labels={labels}
                                        selectedId={focusedId}
                                        mode={mode}
                                        onSelect={(id) => {
                                            setSelectedId(id);
                                            setFocusByView((current) => ({
                                                ...current,
                                                [mode]: id
                                            }));
                                        }}
                                        onClearSelection={() => {
                                            setSelectedId(null);
                                            setFocusByView((current) => ({
                                                ...current,
                                                [mode]: null
                                            }));
                                        }}
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
                                            onClick={() => graph.current?.zoom(1.1)}
                                        >
                                            <ZoomIn size={18} />
                                        </IconButton>
                                        <IconButton
                                            label="Zoom out"
                                            onClick={() => graph.current?.zoom(1 / 1.1)}
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
                                {goalCategories.map((category) => (
                                    <span key={category}>
                                        <span className={`legend-${category.toLowerCase()}`} />
                                        {category}
                                    </span>
                                ))}
                                <span>
                                    <span className="legend-metric" />
                                    Metric
                                </span>
                            </div>
                        </React.Fragment>
                    )}
                </section>
                {selected && mode !== 'cards' && (
                    <EntryDetails
                        key={selected.id}
                        item={selected}
                        items={items}
                        labels={labels}
                        busy={busy || loading}
                        onSave={(updated, groupId) => {
                            const nextItems = items.map((item) =>
                                item.id === updated.id ? updated : item
                            );
                            return save(
                                groupId === undefined
                                    ? nextItems
                                    : moveGoalToGroup(nextItems, updated.id, groupId)
                            );
                        }}
                        onSelect={setSelectedId}
                        onClose={() => setSelectedId(null)}
                        onDelete={() => {
                            setDeleteParentId(null);
                            setDialog('delete');
                        }}
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
                    deleteParent={items.find((item) => item.id === deleteParentId)}
                    items={items}
                    labels={labels}
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
                            if (item.type === 'group') {
                                setMode('list');
                            }
                            setDialog(null);
                        }
                    }}
                    onDelete={async () => {
                        if (!selected) return;
                        if (deleteParentId) {
                            const saved = await save(
                                items.map((item) =>
                                    item.id === deleteParentId
                                        ? {
                                              ...item,
                                              childIds: item.childIds.filter(
                                                  (id) => id !== selected.id
                                              )
                                          }
                                        : item
                                )
                            );
                            if (saved) setDialog(null);
                            return;
                        }
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
