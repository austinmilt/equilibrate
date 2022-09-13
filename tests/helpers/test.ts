import { assert } from "chai";

export async function assertAsyncThrows(
  method: () => Promise<any>
): Promise<void> {
  try {
    await method();
    assert.fail("Expected an error to be thrown");
  } catch (e) {
    // passes
  }
}

export function repeat<T>(
  times: number,
  method: () => Promise<T>
): () => Promise<T> {
  let promise: Promise<T> = method();
  for (let i = 1; i < times; i++) {
    promise = promise.then(method);
  }
  return () => promise;
}
