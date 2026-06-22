const json = (data, status = 200) => {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Accept"
        }
    });
};

const formatValue = (value) => {
    if (value === null || typeof value === "undefined" || value === "") return "—";
    return String(value);
};

const buildTelegramMessage = (payload, request) => {
    const ip = request.headers.get("CF-Connecting-IP")
        || request.headers.get("X-Forwarded-For")
        || "unknown";
    const country = request.headers.get("CF-IPCountry") || "unknown";
    const device = payload.device || {};
    const screen = payload.screen || {};
    const viewport = payload.viewport || {};
    const page = payload.page || {};

    return [
        "🔐 Вход на present-web",
        "",
        `Состояние: ${formatValue(payload.accessState)}`,
        `Время: ${formatValue(payload.localTime || payload.timestamp)}`,
        `IP: ${formatValue(ip)}`,
        `Страна: ${formatValue(country)}`,
        "",
        `URL: ${formatValue(page.url)}`,
        `Referrer: ${formatValue(page.referrer)}`,
        "",
        `Устройство: ${formatValue(device.platform)}`,
        `Язык: ${formatValue(device.language)}`,
        `Timezone: ${formatValue(device.timezone)}`,
        `Touch points: ${formatValue(device.touchPoints)}`,
        `Screen: ${formatValue(screen.width)}×${formatValue(screen.height)} @${formatValue(screen.pixelRatio)}x`,
        `Viewport: ${formatValue(viewport.width)}×${formatValue(viewport.height)}`,
        "",
        `User-Agent: ${formatValue(device.userAgent)}`
    ].join("\n");
};

export default {
    async fetch(request, env) {
        if (request.method === "OPTIONS") return json({ ok: true });
        if (request.method !== "POST") return json({ ok: false }, 405);

        let payload;
        try {
            payload = await request.json();
        } catch {
            return json({ ok: false }, 400);
        }

        if (payload?.security?.accessSecret !== env.ACCESS_SECRET) {
            return json({ ok: false }, 403);
        }

        const token = env.TELEGRAM_BOT_TOKEN;
        const chatId = env.TELEGRAM_CHAT_ID;

        if (!token || !chatId) {
            return json({ ok: false }, 500);
        }

        const message = buildTelegramMessage(payload, request);
        const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text: message,
                disable_web_page_preview: true
            })
        });

        return json({ ok: telegramResponse.ok }, telegramResponse.ok ? 200 : 502);
    }
};
