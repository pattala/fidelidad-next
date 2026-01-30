/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // White-label dynamic colors (defined in index.css CSS variables)
                primary: "var(--color-primary)",
                secondary: "var(--color-secondary)",
                accent: "var(--color-accent)",
                background: "var(--color-background)",
                surface: "var(--color-surface)",
            }
        },
    },
    plugins: [],
}
