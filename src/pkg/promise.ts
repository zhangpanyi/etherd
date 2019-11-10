function sleep(ms: number) {
    return new Promise(
        resolve => setTimeout(resolve, ms));
}

async function nothrow<T>(promise: Promise<T>) {
    try {
        let data = await promise;
        return {data: data, error: null};
    }
    catch (err) {
        return {data: null, error: err};
    }
}

export { sleep, nothrow };