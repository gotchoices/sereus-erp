import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Sereus tests run real nodes: formation, first sync and invitations take seconds.
    testTimeout: 120_000,
    hookTimeout: 240_000,
  },
});
