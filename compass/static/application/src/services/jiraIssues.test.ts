import { requestJira, router } from '@forge/bridge';
import { loadJiraIssue, searchJiraIssues, searchIssues, loadIssue } from './jiraIssues';

jest.mock('@forge/bridge', () => ({ requestJira: jest.fn(), router: { open: jest.fn() } }));

const mockRequestJira = requestJira as jest.MockedFunction<typeof requestJira>;

function response(data: unknown, status = 200): Awaited<ReturnType<typeof requestJira>> {
    return { ok: status === 200, status, json: async () => data } as Awaited<
        ReturnType<typeof requestJira>
    >;
}

test('given issue suggestions from history and current search, duplicate IDs are merged and plain titles are used', async () => {
    const issue = { id: 10001, key: 'LOV-123', summary: '<b>Title</b>', summaryText: 'Title' };
    mockRequestJira.mockResolvedValueOnce(
        response({ sections: [{ issues: [issue] }, { issues: [issue] }] })
    );

    expect(await searchJiraIssues('LOV-123')).toEqual([
        { id: '10001', key: 'LOV-123', summary: 'Title' }
    ]);
    const path = String(mockRequestJira.mock.calls[0][0]);
    expect(path.startsWith('/rest/api/3/issue/picker?')).toBe(true);
    expect(new URLSearchParams(path.split('?')[1]).get('currentJQL')).toBe('ORDER BY updated DESC');
});

test('given special characters, search passes user text as a parameter rather than embedding it in JQL', async () => {
    mockRequestJira.mockResolvedValueOnce(response({ sections: [] }));
    const query = 'plan & "private" OR project = OTHER';

    expect(await searchJiraIssues(query)).toEqual([]);
    const parameters = new URLSearchParams(String(mockRequestJira.mock.calls[0][0]).split('?')[1]);
    expect(parameters.get('query')).toBe(query);
    expect(parameters.get('currentJQL')).toBe('ORDER BY updated DESC');
});

test('given a stable ID after an issue move, loading resolves its current key and title', async () => {
    mockRequestJira.mockResolvedValueOnce(
        response({ id: '10001', key: 'NEW-42', fields: { summary: 'Current title' } })
    );

    expect(await loadJiraIssue('10001')).toEqual({
        id: '10001',
        key: 'NEW-42',
        summary: 'Current title'
    });
    expect(mockRequestJira).toHaveBeenCalledWith('/rest/api/3/issue/10001?fields=summary');
});

test.each([403, 404])(
    'given Jira status %i, no inaccessible issue metadata is returned',
    async (status) => {
        mockRequestJira.mockResolvedValueOnce(
            response({ fields: { summary: 'Not visible' } }, status)
        );
        expect(await loadJiraIssue('10001')).toBeNull();
    }
);

test('given a failed search, the caller receives an actionable error instead of empty results', async () => {
    mockRequestJira.mockResolvedValueOnce(response({}, 401));
    await expect(searchJiraIssues('LOV')).rejects.toThrow('app permissions');
});

test('given a failed issue lookup, the caller receives an actionable error', async () => {
    mockRequestJira.mockResolvedValueOnce(response({}, 500));
    await expect(loadJiraIssue('10001')).rejects.toThrow('app permissions');
});

test('given local preview, only clearly marked sample issues are returned without using Forge', async () => {
    expect(await searchIssues('DEMO-1')).toEqual([
        { id: '10001', key: 'DEMO-1', summary: 'Preview: Improve the application workflow' }
    ]);
    expect(await loadIssue('10001')).toEqual((await searchIssues('DEMO-1'))[0]);
    expect(await searchIssues('D')).toEqual([]);
    expect(mockRequestJira).not.toHaveBeenCalled();
    expect(router.open).not.toHaveBeenCalled();
});
