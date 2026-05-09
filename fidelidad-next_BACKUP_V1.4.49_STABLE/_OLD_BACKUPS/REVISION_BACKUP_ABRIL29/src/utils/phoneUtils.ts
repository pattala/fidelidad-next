/**
 * Utility for normalizing phone numbers, especially for Argentine formats.
 */
export const PhoneUtils = {
    /**
     * Cleans the string from any non-digit character.
     */
    clean(phone: string): string {
        if (!phone) return '';
        return phone.replace(/\D/g, '');
    },

    /**
     * Normalizes an Argentine number to the format required for WhatsApp.
     * Logic: 
     * 1. Clean non-digits.
     * 2. If starts with 0, remove it.
     * 3. If it has 15 (mobile prefix), remove it.
     * 4. If it's 10 digits (no country code), it's likely [AreaCode][Number].
     * 5. Add 549 only if requested, otherwise return clean local digits.
     */
    formatForWhatsApp(phone: string, includePrefix = true): string {
        let cleaned = this.clean(phone);
        if (!cleaned) return '';

        // If it starts with 54, it already has the country code
        if (cleaned.startsWith('54')) {
            // Ensure the '9' (mobile indicator) is there if it's 54[Area]
            // WhatsApp for Argentina usually requires 549[AreaCode][NumberWithout15]
            if (cleaned.length === 12 && !cleaned.startsWith('549')) {
                cleaned = '549' + cleaned.substring(2);
            }
            return cleaned;
        }

        // Remove 0 from the start if present (e.g., 011 -> 11)
        if (cleaned.startsWith('0')) {
            cleaned = cleaned.substring(1);
        }

        // Handle the '15' prefix common in Argenine mobile input
        // Typical format: [AreaCode] 15 [Number] or 15 [Number]
        // If it's a long number (more than 8 digits) and contains 15 after area code (usually position 2-4)
        if (cleaned.length >= 10) {
           // Common area codes: 11 (BA), 2xx, 3xx
           if (cleaned.startsWith('11') && cleaned.substring(2, 4) === '15') {
               cleaned = '11' + cleaned.substring(4);
           } else if (cleaned.substring(3, 5) === '15') {
               cleaned = cleaned.substring(0, 3) + cleaned.substring(5);
           }
        } else if (cleaned.startsWith('15')) {
            // If it's just 15XXXXXX, assume area code is missing or it was just 15
            cleaned = cleaned.substring(2);
        }

        if (includePrefix) {
            return `549${cleaned}`;
        }
        
        return cleaned;
    }
};
