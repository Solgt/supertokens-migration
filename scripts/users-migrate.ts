import dotenv from "dotenv";
import { colors, sleep } from "./utils/utils";

const hardcodedUserId = "insert-user-id-here";

/**
 * If your user metadata has a specific form, you can define it here.
 */
type UserMetadataPayloadSchemaType = any;

const supertokensApiPaths = {
    /**
     * Requires userId param value
     */
    getUserMetadata: "/recipe/user/metadata?userId=",
    /**
     * Requires userId param value
     */
    getUserInfo: "/user/id?userId=",
    /**
     * Requires role param value
     */
    getAllUsersWithRole: "/recipe/role/users?role=",
    /**
     * Requires userId param value
     */
    getUserRoles: "/recipe/user/roles?userId=",
    postSignInUp: "/recipe/signinup",
    postMapUserId: "/recipe/userid/map",
    putMetadataUpdate: "/recipe/user/metadata",
    putUserRoles: "/recipe/user/role",
};
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

        // * Uncomment to migrate a single user
        // const migrationStatus = await migrateUser({
        //     ST_CONNECTION_URI_DEV,
        //     ST_API_KEY_DEV,
        //     ST_CONNECTION_URI_PROD,
        //     ST_API_KEY_PROD,
        //     userId: hardcodedUserId2,
        // });
        // if (migrationStatus !== "OK") {
        //     console.error(`=!=Migration failed for ${hardcodedUserId2}`);
        // }
        // migratedUsers++;
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

function loadEnvironmentAndVerifyEnvVars() {
    let ST_API_KEY_DEV;
    let ST_CONNECTION_URI_DEV;
    let ST_API_KEY_PROD;
    let ST_CONNECTION_URI_PROD;

    dotenv.config({
        path: ".env",
        override: true,
    });

    ST_API_KEY_DEV = process.env.AUTH_SUPERTOKENS_API_KEY;
    ST_CONNECTION_URI_DEV = process.env.AUTH_SUPERTOKENS_CONNECTION_URI;

    dotenv.config({
        path: ".env.production",
        override: true,
    });

    ST_API_KEY_PROD = process.env.AUTH_SUPERTOKENS_API_KEY;
    ST_CONNECTION_URI_PROD = process.env.AUTH_SUPERTOKENS_CONNECTION_URI;

    if (
        !ST_API_KEY_DEV ||
        !ST_CONNECTION_URI_DEV ||
        !ST_API_KEY_PROD ||
        !ST_CONNECTION_URI_PROD
    ) {
        console.error("Missing environment variables");
        process.exit(1);
    }

    if (!ST_CONNECTION_URI_DEV.startsWith("https://st-dev")) {
        console.error(
            "Invalid connection URI for development environment. Expected to start with https://st-dev"
        );
        process.exit(1);
    }

    if (!ST_CONNECTION_URI_PROD.startsWith("https://st-prod")) {
        console.error(
            "Invalid connection URI for production environment. Expected to start with https://st-prod"
        );
        process.exit(1);
    }

    return {
        ST_API_KEY_DEV,
        ST_CONNECTION_URI_DEV,
        ST_API_KEY_PROD,
        ST_CONNECTION_URI_PROD,
    };
}
async function migrateUser({
    ST_CONNECTION_URI_DEV,
    ST_API_KEY_DEV,
    ST_CONNECTION_URI_PROD,
    ST_API_KEY_PROD,
    userId,
}: {
    ST_CONNECTION_URI_DEV: string;
    ST_API_KEY_DEV: string;
    ST_CONNECTION_URI_PROD: string;
    ST_API_KEY_PROD: string;
    userId: string;
}) {
    let existingUserData: {
        user: GetUserResponse | null;
        metadata: UserMetadataPayloadSchemaType | null;
        roles: string[] | null;
    } = {
        user: null,
        metadata: null,
        roles: null,
    };
    /**
     * Get all existing data from user in DEV environment
     */
    existingUserData.user = await getUser({
        ST_CONNECTION_URI: ST_CONNECTION_URI_DEV,
        ST_API_KEY: ST_API_KEY_DEV,
        userId: userId,
    });
    existingUserData.metadata = await getUserMetadata({
        ST_CONNECTION_URI: ST_CONNECTION_URI_DEV,
        ST_API_KEY: ST_API_KEY_DEV,
        userId: userId,
    });
    existingUserData.roles = await getUserRoles({
        ST_CONNECTION_URI: ST_CONNECTION_URI_DEV,
        ST_API_KEY: ST_API_KEY_DEV,
        userId: userId,
    });
    if (
        !existingUserData.user ||
        !existingUserData.metadata ||
        !existingUserData.roles
    ) {
        console.error(
            `=!=User info, metadata or roles not found for user with id: ${userId}. Skipping...`
        );
        return;
    }
    /**
     * Create user in PROD environment
     */
    const thirdPartyId = existingUserData.user.thirdParty[0].id;
    const thirdPartyUserId = existingUserData.user.thirdParty[0].userId;
    const email = existingUserData.user.emails[0];
    const signUpResponse = await signUpUser({
        ST_CONNECTION_URI: ST_CONNECTION_URI_PROD,
        ST_API_KEY: ST_API_KEY_PROD,
        thirdPartyId,
        thirdPartyUserId,
        email,
    });
    const currentUserId = signUpResponse.user.id;
    await sleep(10);
    const mappingRes = await mapUserOldToNewUserId({
        ST_CONNECTION_URI: ST_CONNECTION_URI_PROD,
        ST_API_KEY: ST_API_KEY_PROD,
        currentUserId: currentUserId,
        existingUserId: userId,
    });
    if (mappingRes.status !== "OK") {
        console.error(
            `=!=Failed to map user with id: ${userId} to new id: ${currentUserId}. Migration failed.`
        );
        return;
    }
    await sleep(10);
    await assignRoles({
        /**
         * After mapping, be sure to use the old newly-mapped userId
         * rather than the newly created userId.
         */
        ST_CONNECTION_URI: ST_CONNECTION_URI_PROD,
        ST_API_KEY: ST_API_KEY_PROD,
        userId: userId,
        roles: existingUserData.roles,
    });
    await sleep(10);
    await updateMetadata({
        ST_CONNECTION_URI: ST_CONNECTION_URI_PROD,
        ST_API_KEY: ST_API_KEY_PROD,
        userId: userId,
        metadata: existingUserData.metadata,
    });
    /**
     * Verify migration
     */
    await sleep(30);
    const migratedUserData = {
        user: await getUser({
            ST_CONNECTION_URI: ST_CONNECTION_URI_PROD,
            ST_API_KEY: ST_API_KEY_PROD,
            userId: userId,
        }),
        metadata: await getUserMetadata({
            ST_CONNECTION_URI: ST_CONNECTION_URI_PROD,
            ST_API_KEY: ST_API_KEY_PROD,
            userId: userId,
        }),
        roles: await getUserRoles({
            ST_CONNECTION_URI: ST_CONNECTION_URI_PROD,
            ST_API_KEY: ST_API_KEY_PROD,
            userId: userId,
        }),
    };
    if (
        !migratedUserData.user ||
        JSON.stringify(migratedUserData.metadata) === JSON.stringify({}) ||
        migratedUserData.roles.length === 0
    ) {
        console.error(
            `=!=User info, metadata or roles not found for user with id: ${userId} (unmapped id: ${currentUserId}). Migration failed.`
        );
        return;
    }
    console.info(colors.gray, `===Migration for ${userId} completed`);
    return "OK";
}
type GetUserResponse = {
    id: string;
    isPrimaryUser: boolean;
    tenantIds: string[];
    timeJoined: number;
    emails: string[];
    phoneNumbers: string[];
    thirdParty: [
        {
            id: string;
            userId: string;
        }
    ];
    loginMethods: [
        {
            tentantIds: string[];
            recipeUserId: string;
            verified: boolean;
            timeJoined: number;
            recipeId: string;
            email: string;
            thirdParty: {
                id: string;
                userId: string;
            };
        }
    ];
};
async function getUser({
    ST_CONNECTION_URI,
    ST_API_KEY,
    userId,
}: {
    ST_CONNECTION_URI: string;
    ST_API_KEY: string;
    userId: string;
}) {
    const response = await fetch(
        `${ST_CONNECTION_URI}${supertokensApiPaths.getUserInfo}${userId}`,
        {
            headers: {
                "api-key": ST_API_KEY,
            },
        }
    );
    if (!response.ok) {
        console.error(response);
        throw new Error("Response from request not OK.");
    }
    const body = await response.json();
    if (body.status !== "OK") {
        console.error(body);
        throw new Error("Response from Supertokens not OK.");
    }
    const user = body.user as GetUserResponse;
    return user;
}
async function getUserMetadata({
    ST_CONNECTION_URI,
    ST_API_KEY,
    userId,
}: {
    ST_CONNECTION_URI: string;
    ST_API_KEY: string;
    userId: string;
}) {
    const response = await fetch(
        `${ST_CONNECTION_URI}${supertokensApiPaths.getUserMetadata}${userId}`,
        {
            headers: {
                "api-key": ST_API_KEY,
            },
        }
    );
    if (!response.ok) throw new Error("Response from request not OK.");
    const body = await response.json();
    if (body.status !== "OK")
        throw new Error("Response from Supertokens not OK.");
    const metadata = body.metadata as UserMetadataPayloadSchemaType;
    return metadata;
}
/**
 * Gets all users with a common role. Default common role is "user".
 * Add third argument to override default role.
 */
async function getAllUserIds(
    ST_CONNECTION_URI: string,
    ST_API_KEY: string,
    commonRole: string = "user"
) {
    const response = await fetch(
        `${ST_CONNECTION_URI}${supertokensApiPaths.getAllUsersWithRole}${commonRole}`,
        {
            headers: {
                "api-key": ST_API_KEY,
            },
        }
    );
    if (!response.ok) throw new Error("Response from request not OK.");
    const body = await response.json();
    if (body.status !== "OK")
        throw new Error("Response from Supertokens not OK.");
    const allUsers = body.users as string[];
    return allUsers;
}
async function getUserRoles({
    ST_CONNECTION_URI,
    ST_API_KEY,
    userId,
}: {
    ST_CONNECTION_URI: string;
    ST_API_KEY: string;
    userId: string;
}) {
    const response = await fetch(
        `${ST_CONNECTION_URI}${supertokensApiPaths.getUserRoles}${userId}`,
        {
            headers: {
                "api-key": ST_API_KEY,
            },
        }
    );
    if (!response.ok) {
        console.error(response);
        throw new Error("Response from request not OK.");
    }
    const body = await response.json();
    if (body.status !== "OK") {
        console.error(body);
        throw new Error("Response from Supertokens not OK.");
    }
    const userRoles = body.roles as string[];
    return userRoles;
}
async function signUpUser({
    ST_CONNECTION_URI,
    ST_API_KEY,
    thirdPartyId,
    thirdPartyUserId,
    email,
}: {
    ST_CONNECTION_URI: string;
    ST_API_KEY: string;
    thirdPartyId: string;
    thirdPartyUserId: string;
    email: string;
}) {
    const payload = {
        thirdPartyId: thirdPartyId,
        thirdPartyUserId: thirdPartyUserId,
        email: {
            id: email,
            isVerified: false,
        },
    };
    const response = await fetch(
        `${ST_CONNECTION_URI}${supertokensApiPaths.postSignInUp}`,
        {
            headers: {
                "api-key": ST_API_KEY,
                "Content-Type": "application/json; charset=utf-8",
            },
            method: "POST",
            body: JSON.stringify(payload),
        }
    );
    if (!response.ok) {
        console.error(response);
        throw new Error("Response from request not OK.");
    }
    const body = await response.json();
    if (body.status !== "OK") {
        console.error(body);
        throw new Error("Response from Supertokens not OK.");
    }
    if (body.createdNewUser === false) {
        console.info(colors.gray, `===User already exists for ${email}`);
    }
    type SignUpResponse = {
        status: string;
        createdNewUser: boolean;
        user: GetUserResponse;
    };
    return body as SignUpResponse;
}
async function mapUserOldToNewUserId({
    ST_CONNECTION_URI,
    ST_API_KEY,
    currentUserId,
    existingUserId,
}: {
    ST_CONNECTION_URI: string;
    ST_API_KEY: string;
    currentUserId: string;
    existingUserId: string;
}): Promise<{ status: string }> {
    const payload = {
        superTokensUserId: currentUserId,
        externalUserId: existingUserId,
    };
    const response = await fetch(
        `${ST_CONNECTION_URI}${supertokensApiPaths.postMapUserId}`,
        {
            headers: {
                "api-key": ST_API_KEY,
                "Content-Type": "application/json; charset=utf-8",
            },
            method: "POST",
            body: JSON.stringify(payload),
        }
    );
    if (!response.ok) {
        console.error(response);
        throw new Error("Response from request not OK.");
    }
    const body = await response.json();
    if (body.status !== "OK") {
        if (body.status === "UNKNOWN_SUPERTOKENS_USER_ID_ERROR") {
            /**
             * User mapping may already exist, we query to verify
             */
            const response = await getUser({
                ST_CONNECTION_URI: ST_CONNECTION_URI,
                ST_API_KEY: ST_API_KEY,
                userId: existingUserId,
            });
            if (response && response.id === existingUserId) {
                console.info(
                    colors.gray,
                    `===Mapping already exists for ${existingUserId}`
                );
                return { status: "OK" };
            } else {
                throw new Error(
                    "Response from Supertokens not OK; failed to verify existing mapping."
                );
            }
        }
        console.error(body);
        throw new Error("Response from Supertokens not OK.");
    }
    return body;
}
async function updateMetadata({
    ST_CONNECTION_URI,
    ST_API_KEY,
    userId,
    metadata,
}: {
    ST_CONNECTION_URI: string;
    ST_API_KEY: string;
    userId: string;
    metadata: UserMetadataPayloadSchemaType;
}) {
    /**
     * Does user have any previous metadata?
     */
    const anyExistingMetadata = await getUserMetadata({
        ST_CONNECTION_URI: ST_CONNECTION_URI,
        ST_API_KEY: ST_API_KEY,
        userId: userId,
    });
    if (JSON.stringify(anyExistingMetadata) !== JSON.stringify({})) {
        console.info(
            colors.gray,
            `===User "${userId}" already has metadata. Overwriting...`
        );
    }
    await sleep(10);
    /**
     * Migrate metadata and overwrite any existing.
     */
    const payload = {
        userId,
        metadataUpdate: metadata,
    };
    const response = await fetch(
        `${ST_CONNECTION_URI}${supertokensApiPaths.putMetadataUpdate}`,
        {
            headers: {
                "api-key": ST_API_KEY,
                "Content-Type": "application/json; charset=utf-8",
            },
            method: "PUT",
            body: JSON.stringify(payload),
        }
    );
    if (!response.ok) {
        console.error(response);
        throw new Error("Response from request not OK.");
    }
    const body = await response.json();
    if (body.status !== "OK") {
        console.error(body);
        throw new Error("Response from Supertokens not OK.");
    }
    type MetadataUpdateResponse = {
        status: string;
        metadata: UserMetadataPayloadSchemaType;
    };
    return body as MetadataUpdateResponse;
}
async function assignRoles({
    ST_CONNECTION_URI,
    ST_API_KEY,
    userId,
    roles,
}: {
    ST_CONNECTION_URI: string;
    ST_API_KEY: string;
    userId: string;
    roles: string[];
}) {
    let rolesAdded: string[] = [];
    try {
        const RolesUpdatePromises = roles.map(async (role) => {
            const payload = {
                userId,
                role,
            };
            const response = await fetch(
                `${ST_CONNECTION_URI}${supertokensApiPaths.putUserRoles}`,
                {
                    headers: {
                        "api-key": ST_API_KEY,
                    },
                    method: "PUT",
                    body: JSON.stringify(payload),
                }
            );
            if (!response.ok) {
                console.error(response);
                throw new Error("Response from request not OK.");
            }
            const body = await response.json();
            if (body.status !== "OK") {
                console.error(body);
                throw new Error("Response from Supertokens not OK.");
            }
            if (body.didUserAlreadyHaveRole === true) {
                console.info(
                    colors.gray,
                    `===User "${userId}" already had role "${role}".`
                );
            }
            rolesAdded.push(role);
            await sleep(10);
        });
        await Promise.all(RolesUpdatePromises);
        return rolesAdded;
    } catch (error) {
        console.info(
            colors.magenta,
            `===Roles added before error: ${rolesAdded}`
        );
        throw error;
    }
}
