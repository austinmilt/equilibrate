const FORMATTER: Intl.NumberFormat = new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumSignificantDigits: 3
});


const FORMATTER_SHORT: Intl.NumberFormat = new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumSignificantDigits: 3,
    compactDisplay: "short"
});


export function formatTokens(amount: number, decimals?: number | null | undefined): string {
    amount = convertDecimals(amount, decimals);
    return amount < 1e-3 ? "~0" : FORMATTER.format(amount);
}


export function formatTokensShort(amount: number, decimals?: number | null | undefined): string {
    amount = convertDecimals(amount, decimals);
    return amount < 1e-3 ? "~0" : FORMATTER_SHORT.format(amount);
}


export function convertDecimals(amount: number, decimals?: number | null | undefined): number {
    if (decimals != null) {
        amount /= Math.pow(10, decimals);
    }
    return amount;
}
