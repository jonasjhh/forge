import assert from 'node:assert/strict';
import test from 'node:test';
import { workspaceKey } from './workspace';

test('given different signed-in users, both use the same workspace', () => {
    assert.equal(workspaceKey({ accountId: 'alice' }), workspaceKey({ accountId: 'bob' }));
});

test('given an anonymous request, workspace access is rejected', () => {
    assert.throws(() => workspaceKey({}), /Sign in/);
});

test('given missing request context, workspace access is rejected', () => {
    assert.throws(() => workspaceKey(undefined), /Sign in/);
});
