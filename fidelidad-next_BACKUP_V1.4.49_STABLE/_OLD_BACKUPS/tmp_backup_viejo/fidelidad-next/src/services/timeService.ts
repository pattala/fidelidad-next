
const STORAGE_KEY = 'fiddle_simulated_date_offset';

export const TimeService = {
    /**
     * Returns the current (potentially simulated) date.
     */
    now(): Date {
        const offsetStored = localStorage.getItem(STORAGE_KEY);
        const offset = offsetStored ? parseInt(offsetStored, 10) : 0;

        const date = new Date();
        // Add offset in milliseconds (days * 24 * 60 * 60 * 1000)
        date.setTime(date.getTime() + (offset * 24 * 60 * 60 * 1000));
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

    setOffsetInDays(days: number) {
        localStorage.setItem(STORAGE_KEY, days.toString());
        // Dispatch event for reactive UI updates if needed
        window.dispatchEvent(new Event('time-simulation-change'));
    },

    getOffsetInDays(): number {
        const offset = localStorage.getItem(STORAGE_KEY);
        return offset ? parseInt(offset, 10) : 0;
    },

    reset() {
        localStorage.removeItem(STORAGE_KEY);
        window.dispatchEvent(new Event('time-simulation-change'));
    }
};

// Listen for changes from other tabs
if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) {
            window.dispatchEvent(new Event('time-simulation-change'));
        }
    });
}
