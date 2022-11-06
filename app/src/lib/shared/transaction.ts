import { useCallback } from "react";
import { useEndpoint } from "../solana/provider";


export function useMakeTransactionUrl(): (signature: string) => string {
    const { url: solanaRpcUrl } = useEndpoint();
    return useCallback((signature) => makeTransactionUrl(signature, solanaRpcUrl), [solanaRpcUrl]);
}


export function makeTransactionUrl(signature: string, solanaRpcUrl: string): string {
    const endpointEncoded: string = encodeURIComponent(solanaRpcUrl);
    return `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=${endpointEncoded}`;
}
