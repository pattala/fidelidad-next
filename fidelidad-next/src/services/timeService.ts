
let globalOffset = 0; // Days offset from Firestore

export const TimeService = {
    /**
     * Returns the current (potentially simulated) date.
     */
    now(): Date {
        const date = new Date();
        // Add global offset in milliseconds (days * 24 * 60 * 60 * 1000)
        if (globalOffset !== 0) {
            date.setTime(date.getTime() + (globalOffset * 24 * 60 * 60 * 1000));
        }
        return date;
    },

    /**
     * Returns the strict start of the current (simulated) day.
     */
    startOfToday(): Date {
        const d = this.now();
        d.setHours(0, 0, 0, 0);
        return d;
    },

    /**
     * Sets the global simulation offset (from Firestore config).
     */
    setGlobalOffset(days: number) {
        if (globalOffset !== days) {
            globalOffset = days;
            // Dispatch event for reactive UI updates
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('time-simulation-change'));
            }
        }
    },

    getOffsetInDays(): number {
        return globalOffset;
    },

    /**
     * Parses a local YYYY-MM-DD string into a Date object at 00:00:00.
     * Prevents UTC shifting issues.
     */
    parseLocalDate(isoDate: string, time: string = '00:00:00'): Date {
        if (!isoDate) return new Date();
        // Constructing YYYY-MM-DDTHH:mm:ss forces local time parsing
        return new Date(`${isoDate}T${time}`);
    },

    /**
     * Checks if a prize/campaign has expired according to the simulated date.
     * Considers the item valid until 23:59:59 of the expiration date.
     */
    isExpired(isoDate: string | undefined): boolean {
        if (!isoDate) return false;
        const now = this.now();
        const expirationDate = this.parseLocalDate(isoDate, '23:59:59');
        return now > expirationDate;
    },

    /**
     * Formats an ISO YYYY-MM-DD string as DD/MM for local display.
     * Prevents the common "one day off" bug.
     */
    formatDisplayDate(isoDate: string): string {
        if (!isoDate) return '';
        const [year, month, day] = isoDate.split('-');
        return `${day}/${month}`;
    }
};
