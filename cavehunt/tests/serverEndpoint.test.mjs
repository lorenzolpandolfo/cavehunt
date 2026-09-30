import assert from 'node:assert/strict';
import test from 'node:test';
import { serverEndpoint } from '../src/game/network/serverEndpoint.ts';

test('public HTTPS endpoints retain their default port', () => {
    assert.equal(serverEndpoint('https://foo-abc-credible.ngrok-free.app'), 'https://foo-abc-credible.ngrok-free.app');
    assert.equal(serverEndpoint('https://example.com:8443'), 'https://example.com:8443');
});

test('local hostnames without a scheme use the game server port', () => {
    assert.equal(serverEndpoint('localhost'), 'http://localhost:2567');
    assert.equal(serverEndpoint('localhost:3000'), 'http://localhost:3000');
    assert.equal(serverEndpoint('http://localhost'), 'http://localhost');
});
