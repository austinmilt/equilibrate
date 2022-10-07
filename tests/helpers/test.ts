import { AnchorError } from "@project-serum/anchor";
import { assert, AssertionError } from "chai";

export async function assertAsyncThrows(
  method: () => Promise<any>,
  anchorErrorCode?: string,
  anchorErrorNumber?: number
): Promise<void> {
  try {
    await method();
    assert.fail("Expected an error to be thrown");
  } catch (e) {
    if (e instanceof AssertionError) {
      throw e;
    }
    if (anchorErrorCode || anchorErrorNumber) {
      const error: AnchorError = e as AnchorError;
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
  method: () => Promise<T>,
  printIteration: boolean = false
): () => Promise<T> {
  return async () => {
    let result: T;
    for (let i = 0; i < times; i++) {
      result = await method();
      if (printIteration) {
        console.log(`Result from iteration ${i} = ${result}`);
      }
    }
    return result;
  }
}


export async function sleep(durationMs: number): Promise<void> {
  return await new Promise((r) => setTimeout(r, durationMs));
}
