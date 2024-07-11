# supertokens-migration 🔏👥

Scripts to migrate users from one Supertokens deployment to another. Migrates user info, providers, carries over existing userId, roles and metadata from a source (assumed development) to target (assumed production).

## Prerequisites

-   Requires `bun` to run.
-   Tested with Supertokens Core `v7.0`.
-   Roles and permissions must match between the two environments.
-   All userIds are fetched through a role common to all (default is `user`). If you wish to get all userIds through different role, add third argument to `getAllUserIds()` function or modify it entirely if you want to use different means.
-   Api keys and connection URI required to the two environments. The source credentials are assumed to be in `.env` and are assumed to be development. And the target credentials in `.env.production`. Double-check that these are `.gitignored`. If you want to modify the source and target, look in the `loadEnvironmentAndVerifyEnvVars()` and switch the connection URI validators. The keys looked for are:
    -   `AUTH_SUPERTOKENS_API_KEY`
    -   `AUTH_SUPERTOKENS_CONNECTION_URI`

## Install and Run

-   Fetch repo to your local machine `git clone https://github.com/Solgt/supertokens-migration.git`
-   Install with `bun i`
-   To migrate a single user, run `bun run migrate-user <userId>`
-   To migrate all users with common role, run `bun run migrate`

## Notes

-   Metadata migration expects there to be a non-empty object. If you have users that have no metadata (empty object), this will be flagged as a failed migration for the user in question but the script will continue.
-   Script can be run multiple times over to refresh recent changes.
-   Does not migrate sessions.
-   Time joined will not be migrated over. The users migrated will receive a new time joined based on the time of the migration.

## Author

[Firgrep](https://github.com/Firgrep) (2024)

## License

MIT
