import React, { useEffect, useState } from 'react';
import { ExternalLink, Link2, LoaderCircle, RotateCw, Unlink } from 'lucide-react';
import IconButton from '../../../components/ui/IconButton';
import { loadIssue, openIssue, searchIssues } from '../../../services/jiraIssues';
import type { JiraIssue } from '../../../services/jiraIssues';
import './jiraIssue.css';

export function JiraIssueLink({ issueId }: { issueId: string }) {
    const [attempt, setAttempt] = useState(0);
    const [result, setResult] = useState<{
        issueId: string;
        issue: JiraIssue | null;
        loading: boolean;
        error: string;
    }>({ issueId, issue: null, loading: true, error: '' });
    const [openError, setOpenError] = useState('');

    useEffect(() => {
        let cancelled = false;
        setResult({ issueId, issue: null, loading: true, error: '' });
        setOpenError('');
        loadIssue(issueId)
            .then((issue) => {
                if (!cancelled) setResult({ issueId, issue, loading: false, error: '' });
            })
            .catch(() => {
                if (!cancelled)
                    setResult({
                        issueId,
                        issue: null,
                        loading: false,
                        error: 'Could not load Jira issue. Check your access and the app permissions.'
                    });
            });
        return () => {
            cancelled = true;
        };
    }, [issueId, attempt]);

    if (result.issueId !== issueId || result.loading) {
        return (
            <span className="picker-status" role="status">
                <LoaderCircle size={14} className="spin" /> Loading Jira issue
            </span>
        );
    }
    if (!result.issue) {
        return (
            <span className="jira-issue-unavailable" role="status">
                {result.error || 'Jira issue unavailable or inaccessible.'}
                <IconButton label="Retry Jira issue" onClick={() => setAttempt(attempt + 1)}>
                    <RotateCw size={14} />
                </IconButton>
            </span>
        );
    }
    const issue = result.issue;
    return (
        <span className="jira-issue-reference">
            <a
                className="jira-issue-link"
                href={`/browse/${encodeURIComponent(issue.key)}`}
                target="_blank"
                rel="noreferrer"
                onClick={async (event) => {
                    event.preventDefault();
                    try {
                        await openIssue(issue.key);
                    } catch {
                        setOpenError(
                            'Could not open Jira issue. Open this link from Compass in Jira.'
                        );
                    }
                }}
            >
                <Link2 size={15} aria-hidden="true" />
                <span>
                    <strong>{issue.key}</strong> {issue.summary}
                </span>
                <ExternalLink size={13} aria-hidden="true" />
            </a>
            {openError && (
                <span className="dialog-error" role="alert">
                    {openError}
                </span>
            )}
        </span>
    );
}

interface JiraIssueFieldProps {
    id: string;
    value?: string;
    onChange: (issueId: string | undefined) => void;
    disabled?: boolean;
}

export default function JiraIssueField({ id, value, onChange, disabled }: JiraIssueFieldProps) {
    const [query, setQuery] = useState('');
    const [issues, setIssues] = useState<JiraIssue[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        setIssues([]);
        setError('');
        setSearched(false);
        setLoading(false);
        if (value || disabled || query.trim().length < 2) return;
        setLoading(true);
        const timer = setTimeout(() => {
            searchIssues(query.trim())
                .then((matches) => {
                    if (!cancelled) {
                        setIssues(matches);
                        setSearched(true);
                    }
                })
                .catch(() => {
                    if (!cancelled)
                        setError(
                            'Could not search Jira issues. Check your access and the app permissions.'
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
    }, [query, value, disabled]);

    return (
        <div className="jira-issue-field">
            <label htmlFor={id}>
                Jira-link <span className="optional">optional</span>
            </label>
            {value ? (
                <div className="jira-issue-selected">
                    <JiraIssueLink key={value} issueId={value} />
                    <IconButton
                        label="Remove Jira link"
                        disabled={disabled}
                        onClick={() => {
                            setQuery('');
                            onChange(undefined);
                        }}
                    >
                        <Unlink size={16} />
                    </IconButton>
                </div>
            ) : null}
            <input
                id={id}
                type="search"
                value={query}
                disabled={disabled || Boolean(value)}
                placeholder="Search Jira key or title"
                autoComplete="off"
                maxLength={200}
                onChange={(event) => setQuery(event.target.value)}
            />
            {loading && (
                <p className="picker-status" role="status">
                    <LoaderCircle size={14} className="spin" /> Searching Jira issues
                </p>
            )}
            {error && (
                <p className="dialog-error" role="alert">
                    {error}
                </p>
            )}
            {!loading && searched && !issues.length && (
                <p className="picker-status" role="status">
                    No matching Jira issues.
                </p>
            )}
            {!value && issues.length > 0 && (
                <ul className="jira-issue-results" aria-label="Jira issue matches">
                    {issues.map((issue) => (
                        <li key={issue.id}>
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => {
                                    onChange(issue.id);
                                    setQuery('');
                                }}
                            >
                                <Link2 size={15} aria-hidden="true" />
                                <span>
                                    <strong>{issue.key}</strong> {issue.summary}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
