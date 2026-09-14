import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // server/ 下的测试用 Node 内置 test runner（`npm --prefix server test`），不归 vitest 管
    exclude: ['**/node_modules/**', '**/dist/**', 'server/**'],
  },
});
