import { requestJira } from '@forge/bridge';
import { getUserAvatar, loadJiraAvatar } from './jiraUsers';

jest.mock('@forge/bridge', () => ({ requestJira: jest.fn() }));

const mockRequestJira = requestJira as jest.MockedFunction<typeof requestJira>;
const oldAvatar =
    'https://avatar-management--avatars.us-west-2.prod.public.atl-paas.net/initials/AM-5.png';
const currentAvatar =
    'https://avatar-management--avatars.us-west-2.prod.public.atl-paas.net/initials/AM-2.png';

function avatarResponse(avatarUrl: string): Awaited<ReturnType<typeof requestJira>> {
    return { ok: true, json: async () => ({ avatarUrls: { '48x48': avatarUrl } }) } as Awaited<
        ReturnType<typeof requestJira>
    >;
}

test('given saved avatar metadata, fresh Jira avatar URLs take priority without changing the color suffix', () => {
    expect(getUserAvatar({ avatarUrl: oldAvatar, avatarUrls: { '48x48': currentAvatar } })).toBe(
        currentAvatar
    );
});

test('given a stored avatar, loading in Jira refreshes it from the account rather than returning the snapshot', async () => {
    mockRequestJira.mockResolvedValueOnce(avatarResponse(currentAvatar));

    const result = await loadJiraAvatar({
        accountId: 'jira-updated-avatar',
        displayName: 'Alex Morgan',
        avatarUrl: oldAvatar
    });

    expect(result).toBe(currentAvatar);
    expect(mockRequestJira).toHaveBeenCalledWith('/rest/api/3/user?accountId=jira-updated-avatar');
});

test('given an avatar from another Atlassian production region, its URL and color are preserved', () => {
    const regionalAvatar =
        'https://avatar-management--avatars.ap-southeast-2.prod.public.atl-paas.net/initials/AM-3.png';
    expect(getUserAvatar({ avatarUrl: regionalAvatar })).toBe(regionalAvatar);
});

test('given the same account rendered several times, the current Jira avatar request is shared', async () => {
    mockRequestJira.mockResolvedValueOnce(avatarResponse(currentAvatar));
    const user = {
        accountId: 'jira-shared-avatar-request',
        displayName: 'Alex Morgan',
        avatarUrl: oldAvatar
    };

    const avatars = await Promise.all([loadJiraAvatar(user), loadJiraAvatar(user)]);

    expect(avatars).toEqual([currentAvatar, currentAvatar]);
    expect(mockRequestJira).toHaveBeenCalledTimes(1);
});

test('given an unavailable Jira user API, the saved avatar remains the fallback', async () => {
    mockRequestJira.mockRejectedValueOnce(new Error('Request unavailable'));

    expect(
        await loadJiraAvatar({
            accountId: 'jira-avatar-unavailable',
            displayName: 'Alex Morgan',
            avatarUrl: oldAvatar
        })
    ).toBe(oldAvatar);
});

test('given a failed cached avatar, refreshing the account fetches a newer URL', async () => {
    mockRequestJira
        .mockResolvedValueOnce(avatarResponse(oldAvatar))
        .mockResolvedValueOnce(avatarResponse(currentAvatar));
    const user = {
        accountId: 'jira-avatar-retry',
        displayName: 'Alex Morgan',
        avatarUrl: oldAvatar
    };

    expect(await loadJiraAvatar(user)).toBe(oldAvatar);
    expect(await loadJiraAvatar(user, true)).toBe(currentAvatar);
    expect(mockRequestJira).toHaveBeenCalledTimes(2);
});
