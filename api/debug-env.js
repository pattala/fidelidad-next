export default function handler(req, res) {
    const envKeys = Object.keys(process.env);
    const googleCredsPreview = process.env.GOOGLE_CREDENTIALS_JSON
        ? "Present (First 20 chars: " + process.env.GOOGLE_CREDENTIALS_JSON.substring(0, 20) + "...)"
        : "MISSING";

    res.status(200).json({
        ok: true,
        envKeys: envKeys,
        google_creds_status: googleCredsPreview,
        node_env: process.env.NODE_ENV
    });
}
