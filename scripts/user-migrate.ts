import { loadEnvironmentAndVerifyEnvVars, migrateUser } from "./internals";
import { colors } from "./utils/utils";

/**
 * Migrate a single supertokens user with userId, roles, permissions, and metadata (not session).
 * @note ➡️ Run with `bun run scripts/user-migrate.ts <userId>`.
 * @note ⚠️ Must use `bun` to run this script!
 * @note Must have `.env` and `.env.production` files in root directory with
 * supertokens connection URI and API key for the two environments.
 */
async function main() {
    try {
        const argUser = process.argv[2];
        if (!argUser) {
            console.error("No userId provided as argument");
            process.exit(1);
        }
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

        let migratedUsers = 0;

        const migrationStatus = await migrateUser({
            ST_CONNECTION_URI_DEV,
            ST_API_KEY_DEV,
            ST_CONNECTION_URI_PROD,
            ST_API_KEY_PROD,
            userId: argUser,
        });
        if (migrationStatus !== "OK") {
            console.error(`=!=Migration failed for ${argUser}`);
        }
        migratedUsers++;
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
