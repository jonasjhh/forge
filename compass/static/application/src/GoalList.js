import React, { useState } from 'react';
import { ChevronRight, Folder, Gauge, Target } from 'lucide-react';
import { buildListRows } from './entries';

export default function GoalList({ items, entries, selectedId, busy, onSelect, onMove }) {
    const folders = items.filter((entry) => entry.type === 'folder');
    const filterKey = entries.map((entry) => entry.id).join('|');
    const [collapseState, setCollapseState] = useState(() => ({ filterKey, paths: new Set() }));
    const [rowLimit, setRowLimit] = useState(250);
    const collapsedPaths = collapseState.filterKey === filterKey ? collapseState.paths : new Set();
    const projectedRows = buildListRows(items, entries, collapsedPaths, rowLimit + 1);
    const rows = projectedRows.slice(0, rowLimit);

    function toggleBranch(path) {
        setCollapseState((current) => {
            const next = new Set(current.filterKey === filterKey ? current.paths : []);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return { filterKey, paths: next };
        });
    }
    return (
        <div className="goal-list-view">
            <table className="goal-table">
                <caption className="visually-hidden">
                    Folders, goals, sub-goals, and metrics
                </caption>
                <thead>
                    <tr>
                        <th scope="col">Name</th>
                        <th scope="col" className="column-assignees">
                            Assignees
                        </th>
                        <th scope="col" className="column-folder">
                            Folder
                        </th>
                        <th scope="col" className="column-parents">
                            Parent goals
                        </th>
                        <th scope="col" className="column-metrics">
                            Metrics
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(({ entry, depth, path, hasChildren }) => {
                        const parents = items.filter(
                            (candidate) =>
                                candidate.type === 'goal' && candidate.childIds.includes(entry.id)
                        );
                        const folder = folders.find((candidate) =>
                            candidate.childIds.includes(entry.id)
                        );
                        const metrics = items.filter(
                            (candidate) =>
                                candidate.type === 'metric' && entry.childIds.includes(candidate.id)
                        );
                        const label =
                            entry.type === 'folder'
                                ? 'Folder'
                                : entry.type === 'metric'
                                  ? 'Metric'
                                  : parents.length
                                    ? 'Sub-goal'
                                    : 'Goal';
                        const EntryIcon =
                            entry.type === 'folder'
                                ? Folder
                                : entry.type === 'metric'
                                  ? Gauge
                                  : Target;
                        return (
                            <tr
                                key={path}
                                data-entry-id={entry.id}
                                data-depth={depth}
                                className={`entry-row entry-row-${entry.type} ${selectedId === entry.id ? 'selected-row' : ''}`}
                            >
                                <th scope="row">
                                    <div
                                        className="hierarchy-name"
                                        style={{ '--row-depth': depth }}
                                    >
                                        {hasChildren ? (
                                            <button
                                                type="button"
                                                className="branch-toggle"
                                                aria-label={`${collapsedPaths.has(path) ? 'Expand' : 'Collapse'} ${entry.name}`}
                                                title={`${collapsedPaths.has(path) ? 'Expand' : 'Collapse'} ${entry.name}`}
                                                aria-expanded={!collapsedPaths.has(path)}
                                                onClick={() => toggleBranch(path)}
                                            >
                                                <ChevronRight size={16} />
                                            </button>
                                        ) : (
                                            <span className="branch-spacer" aria-hidden="true" />
                                        )}
                                        <button
                                            type="button"
                                            className="goal-name"
                                            aria-label={`Open ${entry.type} ${entry.name}`}
                                            aria-pressed={selectedId === entry.id}
                                            onClick={() => onSelect(entry.id)}
                                        >
                                            <EntryIcon
                                                size={17}
                                                className={`entry-icon-${entry.type}`}
                                            />
                                            <span>
                                                <span className="goal-name-text">{entry.name}</span>
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
                                                <span
                                                    className="table-assignee"
                                                    key={assignee.accountId}
                                                >
                                                    {assignee.displayName}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="muted">
                                                {entry.type === 'folder' ? '-' : 'Unassigned'}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="column-folder">
                                    {entry.type === 'goal' ? (
                                        <select
                                            aria-label={`Folder for ${entry.name}`}
                                            value={folder?.id || ''}
                                            disabled={busy}
                                            onChange={(event) =>
                                                onMove(entry.id, event.target.value)
                                            }
                                        >
                                            <option value="">No direct folder</option>
                                            {folders.map((candidate) => (
                                                <option key={candidate.id} value={candidate.id}>
                                                    {candidate.name}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <span className="muted">
                                            {entry.type === 'folder' ? '-' : 'Via goal'}
                                        </span>
                                    )}
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
                                                {entry.type === 'folder' ? '-' : 'None'}
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
                            </tr>
                        );
                    })}
                </tbody>
            </table>
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
                    <h2>No matching folders, goals, or metrics</h2>
                </div>
            )}
        </div>
    );
}
