import { ID, OAuthProvider, Query } from "appwrite";
import { account, database, appwriteConfig } from "~/appwrite/client";
import { redirect } from "react-router";

// Fetch Google profile picture using OAuth access token
const getGooglePicture = async (accessToken: string) => {
    try {
        const response = await fetch(
            "https://people.googleapis.com/v1/people/me?personFields=photos",
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!response.ok) throw new Error("Failed to fetch Google profile picture");

        const { photos } = await response.json();
        return photos?.[0]?.url || null;
    } catch (error) {
        console.error("Error fetching Google picture:", error);
        return null;
    }
};

// Check if a user document already exists for this account ID
export const getExistingUser = async (id: string) => {
    try {
        //noinspection JSDeprecatedSymbols
        const { documents, total } = await database.listDocuments({
            databaseId: appwriteConfig.databaseId,
            collectionId: appwriteConfig.userCollectionId,
            queries: [Query.equal("accountId", id)],
        });
        return total > 0 ? documents[0] : null;
    } catch (error) {
        console.error("Error fetching user:", error);
        return null;
    }
};

// Save logged-in user's info as a new document in the database
export const storeUserData = async () => {
    try {
        const user = await account.get();
        if (!user) throw new Error("User not found");

        // Get OAuth access token from current session
        const { providerAccessToken } =
        (await account.getSession({ sessionId: "current" })) || {};

        const profilePicture = providerAccessToken
            ? await getGooglePicture(providerAccessToken)
            : null;

        //noinspection JSDeprecatedSymbols
        const createdUser = await database.createDocument({
            databaseId: appwriteConfig.databaseId,
            collectionId: appwriteConfig.userCollectionId,
            documentId: ID.unique(),
            data: {
                accountId: user.$id,
                email: user.email,
                name: user.name,
                imageUrl: profilePicture,
                joinedAt: new Date().toISOString(),
            },
        });

        if (!createdUser.$id) return redirect("/sign-in");

        return createdUser;
    } catch (error) {
        console.error("Error storing user data:", error);
        return null;
    }
};

// Start Google OAuth login flow (redirects the page)
export const loginWithGoogle = async () => {
    try {
        account.createOAuth2Session({
            provider: OAuthProvider.Google,
            success: `${window.location.origin}/`,
            failure: `${window.location.origin}/404`,
        });
    } catch (error) {
        console.error("Error during OAuth2 session creation:", error);
    }
};

// Log out by deleting current session
export const logoutUser = async () => {
    try {
        await account.deleteSession({ sessionId: "current" });
    } catch (error) {
        console.error("Error during logout:", error);
    }
};

// Get logged-in user's data, or redirect to sign-in
export const getUser = async () => {
    try {
        const user = await account.get();
        if (!user) return redirect("/sign-in");

        //noinspection JSDeprecatedSymbols
        const { documents } = await database.listDocuments({
            databaseId: appwriteConfig.databaseId,
            collectionId: appwriteConfig.userCollectionId,
            queries: [
                Query.equal("accountId", user.$id),
                Query.select(["name", "email", "imageUrl", "joinedAt", "accountId"]),
            ],
        });

        return documents.length > 0 ? documents[0] : redirect("/sign-in");
    } catch (error) {
        console.error("Error fetching user:", error);
        return redirect("/sign-in");
    }
};