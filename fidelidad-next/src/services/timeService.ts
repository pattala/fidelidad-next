
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
    }
};
