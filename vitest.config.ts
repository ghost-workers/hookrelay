// ABOUTME: Vitest configuration for HookRelay tests.
// ABOUTME: Sets up test environment with in-memory SQLite database.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      HOOKRELAY_DB_PATH: ':memory:',
    },
  },
});
