const FORMATTER: Intl.NumberFormat = new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumSignificantDigits: 3
});


export function formatTokens(amount: number, decimals?: number | null | undefined): string {
    if (decimals != null) {
        amount /= Math.pow(10, decimals);
    }
    return amount < 1e-3 ? "~0" : FORMATTER.format(amount);
}
