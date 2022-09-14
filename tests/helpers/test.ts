import { AnchorError } from "@project-serum/anchor";
import { assert } from "chai";

export async function assertAsyncThrows(
  method: () => Promise<any>,
  anchorErrorCode?: string,
  anchorErrorNumber?: number
): Promise<void> {
  try {
    await method();
    assert.fail("Expected an error to be thrown");
  } catch (e) {
    if (anchorErrorCode || anchorErrorNumber) {
      const error: AnchorError = e as AnchorError;
      console.log(error.error.errorCode.code, anchorErrorCode, error.error.errorCode.code ===  anchorErrorCode);
      if (anchorErrorCode != null) {
        assert.strictEqual(error.error.errorCode.code, anchorErrorCode);
      }
      if (anchorErrorNumber != null) {
        assert.strictEqual(error.error.errorCode.number, anchorErrorNumber);
      }
    }
    // otherwise it passes if any error is thrown
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
