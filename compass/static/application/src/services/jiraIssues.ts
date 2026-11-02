export interface JiraIssue {
    id: string;
    key: string;
    summary: string;
}

const previewIssues: JiraIssue[] = [
    { id: '10001', key: 'DEMO-1', summary: 'Preview: Improve the application workflow' },
    { id: '10002', key: 'DEMO-2', summary: 'Preview: Publish the delivery plan' }
];
const issueRequests = new Map<string, Promise<JiraIssue | null>>();

function isPreview(): boolean {
    return ['localhost', '127.0.0.1'].includes(window.location.hostname);
}

export async function searchIssues(query: string): Promise<JiraIssue[]> {
    if (query.trim().length < 2) return [];
    if (isPreview()) {
        return previewIssues.filter((issue) =>
            `${issue.key} ${issue.summary}`.toLowerCase().includes(query.trim().toLowerCase())
        );
    }
    return searchJiraIssues(query);
}

export async function searchJiraIssues(query: string): Promise<JiraIssue[]> {
    const { requestJira } = await import('@forge/bridge');
    const parameters = new URLSearchParams({
        query: query.trim(),
        currentJQL: 'ORDER BY updated DESC',
        showSubTasks: 'true',
        showSubTaskParent: 'true'
    });
    const response = await requestJira(`/rest/api/3/issue/picker?${parameters}`);
    if (!response.ok) {
        throw new Error('Could not search Jira issues. Check your access and the app permissions.');
    }
    const data: {
        sections?: { issues?: { id: string | number; key: string; summaryText: string }[] }[];
    } = await response.json();
    const issues = new Map<string, JiraIssue>();
    for (const section of data.sections ?? []) {
        for (const issue of section.issues ?? []) {
            const id = String(issue.id);
            if (/^[1-9]\d{0,19}$/.test(id) && typeof issue.summaryText === 'string') {
                issues.set(id, { id, key: issue.key, summary: issue.summaryText });
            }
        }
    }
    return [...issues.values()].slice(0, 20);
}

export async function loadIssue(issueId: string): Promise<JiraIssue | null> {
    if (isPreview()) return previewIssues.find((issue) => issue.id === issueId) ?? null;
    let request = issueRequests.get(issueId);
    if (!request) {
        request = loadJiraIssue(issueId);
        issueRequests.set(issueId, request);
    }
    try {
        const issue = await request;
        if (!issue) issueRequests.delete(issueId);
        return issue;
    } catch (error) {
        issueRequests.delete(issueId);
        throw error;
    }
}

export async function loadJiraIssue(issueId: string): Promise<JiraIssue | null> {
    const { requestJira } = await import('@forge/bridge');
    const response = await requestJira(
        `/rest/api/3/issue/${encodeURIComponent(issueId)}?fields=summary`
    );
    if (response.status === 403 || response.status === 404) return null;
    if (!response.ok) {
        throw new Error('Could not load Jira issue. Check your access and the app permissions.');
    }
    const issue: { id: string; key: string; fields: { summary: string } } = await response.json();
    return { id: issue.id, key: issue.key, summary: issue.fields.summary };
}

export async function openIssue(key: string): Promise<void> {
    if (isPreview()) throw new Error('Open this link from Compass in Jira, not local preview.');
    const { router } = await import('@forge/bridge');
    await router.open(`/browse/${encodeURIComponent(key)}`);
}
