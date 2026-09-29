import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // These integration tests share one development database.  Running files
    // one at a time keeps temporary fixture rows from leaking into another
    // file's assertions while each file still cleans up after itself.
    fileParallelism: false,
  },
});
