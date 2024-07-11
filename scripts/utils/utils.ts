export const colors = {
    red: "\x1b[31m%s\x1b[0m",
    green: "\x1b[32m%s\x1b[0m",
    yellow: "\x1b[33m%s\x1b[0m",
    blue: "\x1b[34m%s\x1b[0m",
    magenta: "\x1b[35m%s\x1b[0m",
    cyan: "\x1b[36m%s\x1b[0m",
    gray: "\x1b[37m%s\x1b[0m",
};

export function arraysEqual(arr1: any[], arr2: any[]) {
    if (arr1.length !== arr2.length) {
        return false;
    }

    // Sort both arrays
    const sortedArr1 = arr1.slice().sort();
    const sortedArr2 = arr2.slice().sort();

    // Compare sorted arrays
    for (let i = 0; i < sortedArr1.length; i++) {
        if (sortedArr1[i] !== sortedArr2[i]) {
            return false;
        }
    }

    return true;
}

/**
 * Quick and easy to force a delay in an async function. Input is in milliseconds.
 * Don't forget to use `await` when calling this function.
 */
export async function sleep(ms: number) {
    return await new Promise((r) => setTimeout(r, ms));
}
