export function formatTargetMonth(value: string, month: 'long' | 'short' = 'long'): string {
    return new Intl.DateTimeFormat(undefined, {
        month,
        year: 'numeric',
        timeZone: 'UTC'
    }).format(new Date(`${value}-01T00:00:00.000Z`));
}
