import {
    getAllUserIds,
    loadEnvironmentAndVerifyEnvVars,
    migrateUser,
} from "./internals";
import { colors } from "./utils/utils";

/**
 * Migrate supertokens users with userId, roles, permissions, and metadata (not session).
 * @note ➡️ Run with `bun run scripts/users-migrate.ts`.
 * @note ⚠️ Must use `bun` to run this script!
 * @note Must have `.env` and `.env.production` files in root directory with
 * supertokens connection URI and API key for the two environments.
 */
async function main() {
    try {
        /**
         * Setup and checks
         */
        const {
            ST_API_KEY_DEV,
            ST_API_KEY_PROD,
            ST_CONNECTION_URI_DEV,
            ST_CONNECTION_URI_PROD,
        } = loadEnvironmentAndVerifyEnvVars();
        /**
         * Main logic
         */
        console.info(colors.cyan, "===Migration script started");
        const allExistingUsers = await getAllUserIds(
            ST_CONNECTION_URI_DEV,
            ST_API_KEY_DEV
        );
        if (allExistingUsers.length === 0)
            throw new Error("No existing users found.");

        let migratedUsers = 0;

        for (const userId of allExistingUsers) {
            const migrationStatus = await migrateUser({
                ST_CONNECTION_URI_DEV,
                ST_API_KEY_DEV,
                ST_CONNECTION_URI_PROD,
                ST_API_KEY_PROD,
                userId,
            });
            if (migrationStatus !== "OK") {
                console.error(`=!=Migration failed for ${userId}`);
                continue;
            }
            migratedUsers++;
        }

        /**
         * Logging output
         */
        if (migratedUsers > 0) {
            console.info(colors.green, `===Users migrated: ${migratedUsers}`);
        }
    } catch (error) {
        throw error;
    } finally {
        console.info(colors.yellow, "===Script completed");
    }
}
main();
