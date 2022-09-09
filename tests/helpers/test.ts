import { assert } from "chai";

export async function assertAsyncThrows(method: () => Promise<any>): Promise<void> {
    try {
        await method();
        assert.fail('Expected an error to be thrown');
    } catch (e) {
        // passes
    }
}