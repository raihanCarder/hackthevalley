import { test as base, expect } from "@playwright/test";
import { Pool } from "pg";
export type { Page } from "@playwright/test";

export const test = base.extend<{ resetLocalJournal: void }>({
  resetLocalJournal: [async ({}, use) => {
    const url = process.env.TEST_DATABASE_URL;
    if (url) {
      const options = new URL(url).searchParams.get("options");
      // Never clear a user's journal. The acceptance runner creates this disposable schema.
      if (!options || !/^-c search_path=journal_browser_[a-f0-9]+$/.test(options)) throw new Error("Use npm run test:local-browser for isolated journal acceptance.");
      const pool = new Pool({ connectionString: url });
      try { await pool.query("DELETE FROM daily_entries WHERE profile_id = 'local-you'"); }
      finally { await pool.end(); }
    }
    await use();
  }, { auto: true }],
});
export { expect };
