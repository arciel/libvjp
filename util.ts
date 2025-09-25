export function assert(condition: any, msg?: string): asserts condition {
    if (!condition) {
        throw new Error(`Assertion failed: ${msg}`);
    }
}

export function logThru<T>(v: T, msg?: string):T {
    // console.log(msg, v);
    return v;
}