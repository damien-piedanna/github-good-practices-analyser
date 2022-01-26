
// eslint-disable-next-line @typescript-eslint/no-floating-promises
import { db, getUncategorizedRepositories } from "../tools/database";

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
    await db.sync();

    console.log('Fetching uncategorized repositories...');
    const repositories = await getUncategorizedRepositories();
})();