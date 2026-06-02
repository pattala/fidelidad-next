/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: "#6d28d9", // Purple-700
                secondary: "#10b981", // Emerald-500
                accent: "#f59e0b", // Amber-500
                background: "#f8fafc", // Slate-50
                surface: "#ffffff",
            }
        },
    },
    plugins: [],
}
