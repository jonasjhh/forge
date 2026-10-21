import React, { useEffect, useState } from 'react';
import { LoaderCircle, Plus, UserRound, X } from 'lucide-react';

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
        .map((user) => ({ accountId: user.accountId, displayName: user.displayName }));
}

export function AssigneePicker({ value, onChange, disabled, id }) {
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
    }, [query]);

    const available = users.filter(
        (user) => !value.some((assignee) => assignee.accountId === user.accountId)
    );
    return (
        <div className="assignee-picker">
            <label htmlFor={id}>
                Assignees <span className="count">{value.length}</span>
            </label>
            <ul className="assignee-list">
                {value.map((user) => (
                    <li key={user.accountId}>
                        <UserRound size={14} />
                        <span>{user.displayName}</span>
                        <button
                            className="icon-button"
                            type="button"
                            aria-label={`Remove assignee ${user.displayName}`}
                            title={`Remove ${user.displayName}`}
                            disabled={disabled}
                            onClick={() =>
                                onChange(
                                    value.filter(
                                        (assignee) => assignee.accountId !== user.accountId
                                    )
                                )
                            }
                        >
                            <X size={14} />
                        </button>
                    </li>
                ))}
            </ul>
            <input
                id={id}
                type="search"
                placeholder="Search Jira users"
                autoComplete="off"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                disabled={disabled || value.length >= 20}
            />
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
                {available.map((user) => (
                    <li key={user.accountId}>
                        <button
                            type="button"
                            disabled={disabled || value.length >= 20}
                            onClick={() => {
                                onChange([...value, user]);
                                setQuery('');
                            }}
                        >
                            <UserRound size={15} />
                            <span>{user.displayName}</span>
                            <Plus size={15} />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
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
