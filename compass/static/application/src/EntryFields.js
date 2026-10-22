import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, LoaderCircle, Plus, UsersRound } from 'lucide-react';
import AssigneeChip, { AssigneeAvatar, getUserAvatar } from './AssigneeChip';

const previewUsers = [
    { accountId: 'preview-alex', displayName: 'Alex Morgan' },
    { accountId: 'preview-sam', displayName: 'Sam Taylor' },
    { accountId: 'preview-robin', displayName: 'Robin Chen' }
];

async function searchUsers(query) {
    if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
        return previewUsers.filter((user) =>
            user.displayName.toLowerCase().includes(query.toLowerCase())
        );
    }
    const { requestJira } = await import('@forge/bridge');
    const response = await requestJira(
        `/rest/api/3/user/search?query=${encodeURIComponent(query)}&maxResults=20`
    );
    if (!response.ok) throw new Error('User search failed.');
    const users = await response.json();
    return users
        .filter((user) => user.active && user.accountType !== 'app')
        .map((user) => ({
            accountId: user.accountId,
            displayName: user.displayName,
            ...(getUserAvatar(user) ? { avatarUrl: getUserAvatar(user) } : {})
        }));
}

export function AssigneePicker({
    value,
    onChange,
    disabled,
    id,
    options,
    label = 'Assignees',
    placeholder = 'Search Jira users',
    maxSelections = 20
}) {
    const [query, setQuery] = useState('');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searched, setSearched] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setUsers([]);
        setError('');
        setSearched(false);
        setLoading(false);
        if (options !== undefined) {
            setUsers(
                options.filter((user) =>
                    user.displayName.toLowerCase().includes(query.trim().toLowerCase())
                )
            );
            setSearched(true);
            return;
        }
        if (query.trim().length < 2) return;
        setLoading(true);
        const timer = setTimeout(() => {
            searchUsers(query.trim())
                .then((results) => {
                    if (!cancelled) {
                        setUsers(results);
                        setSearched(true);
                    }
                })
                .catch(() => {
                    if (!cancelled)
                        setError(
                            'Could not search Jira users. Check the app permissions and your Browse users and groups permission.'
                        );
                })
                .finally(() => {
                    if (!cancelled) setLoading(false);
                });
        }, 250);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [query, options]);

    const available = users.filter(
        (user) => !value.some((assignee) => assignee.accountId === user.accountId)
    );
    return (
        <div className="assignee-picker">
            <label htmlFor={id}>
                {label} <span className="count">{value.length}</span>
            </label>
            <div className="assignee-control">
                <ul className="assignee-list">
                    {value.map((user) => (
                        <li key={user.accountId}>
                            <AssigneeChip
                                user={user}
                                disabled={disabled}
                                onRemove={() =>
                                    onChange(
                                        value.filter(
                                            (assignee) => assignee.accountId !== user.accountId
                                        )
                                    )
                                }
                            />
                        </li>
                    ))}
                </ul>
                <input
                    id={id}
                    type="search"
                    placeholder={placeholder}
                    autoComplete="off"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    disabled={disabled || value.length >= maxSelections}
                />
            </div>
            {loading && (
                <p className="picker-status" role="status">
                    <LoaderCircle size={14} className="spin" />
                    Searching users
                </p>
            )}
            {error && (
                <p className="dialog-error" role="alert">
                    {error}
                </p>
            )}
            {!loading && searched && !available.length && (
                <p className="picker-status" role="status">
                    No matching users.
                </p>
            )}
            <ul className="user-results">
                {available.slice(0, options === undefined ? 20 : 30).map((user) => (
                    <li key={user.accountId}>
                        <button
                            type="button"
                            disabled={disabled || value.length >= maxSelections}
                            onClick={() => {
                                onChange([...value, user]);
                                setQuery('');
                            }}
                        >
                            <AssigneeAvatar user={user} />
                            <span>{user.displayName}</span>
                            <Plus size={15} />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function AssigneeFilter({ users, value, onChange }) {
    const details = useRef(null);
    const [open, setOpen] = useState(false);
    useEffect(() => {
        const closeOutside = (event) => {
            if (details.current && !details.current.contains(event.target))
                details.current.open = false;
        };
        document.addEventListener('pointerdown', closeOutside);
        return () => document.removeEventListener('pointerdown', closeOutside);
    }, []);
    return (
        <details
            ref={details}
            className="assignee-filter"
            onToggle={(event) => setOpen(event.currentTarget.open)}
            onKeyDown={(event) => {
                if (event.key === 'Escape') {
                    event.currentTarget.open = false;
                    event.currentTarget.querySelector('summary').focus();
                }
            }}
        >
            <summary
                className={`button secondary ${value.length ? 'filter-active' : ''}`}
                aria-label="Filter by assignee"
            >
                <UsersRound size={16} />
                <span>Assignees</span>
                {value.length > 0 && <span className="count">{value.length}</span>}
                <ChevronDown size={14} />
            </summary>
            {open && (
                <div className="assignee-filter-panel" role="group" aria-label="Assignee filter">
                    <AssigneePicker
                        id="filter-assignees"
                        label="Filter by assignee"
                        placeholder="Search assignees"
                        options={users}
                        value={value}
                        onChange={onChange}
                        maxSelections={Infinity}
                    />
                    <button
                        type="button"
                        className="button secondary clear-assignee-filter"
                        disabled={!value.length}
                        onClick={() => onChange([])}
                    >
                        Clear all
                    </button>
                </div>
            )}
        </details>
    );
}

export function MetricFields({ value, onChange, disabled, prefix }) {
    return (
        <div className="metric-fields">
            <div className="metric-value-row">
                {[
                    ['currentValue', 'Current value'],
                    ['targetValue', 'Target value']
                ].map(([field, label]) => (
                    <div key={field}>
                        <label htmlFor={`${prefix}-${field}`}>{label}</label>
                        <input
                            id={`${prefix}-${field}`}
                            type="number"
                            step="any"
                            value={value[field] ?? ''}
                            disabled={disabled}
                            onChange={(event) =>
                                onChange({
                                    ...value,
                                    [field]:
                                        event.target.value === ''
                                            ? null
                                            : Number(event.target.value)
                                })
                            }
                        />
                    </div>
                ))}
            </div>
            <label htmlFor={`${prefix}-unit`}>Unit</label>
            <input
                id={`${prefix}-unit`}
                placeholder="%, hours, requests"
                maxLength={40}
                value={value.unit || ''}
                disabled={disabled}
                onChange={(event) => onChange({ ...value, unit: event.target.value })}
            />
        </div>
    );
}
