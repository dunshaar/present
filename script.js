const PASSWORD = typeof siteSettings !== "undefined"
    ? String(siteSettings.password || "")
    : "18.02.2026";
const OPEN_DATE = new Date(
    typeof siteSettings !== "undefined"
        ? siteSettings.openDate
        : "2026-06-21T00:00:00"
);
const IS_LOCAL_PREVIEW = ["127.0.0.1", "localhost"].includes(window.location.hostname)
    && new URLSearchParams(window.location.search).get("preview") === "1";

const entryScreen = document.getElementById("entryScreen");
const waitingScreen = document.getElementById("waitingScreen");
const site = document.getElementById("site");

const passwordForm = document.getElementById("passwordForm");
const passwordInput = document.getElementById("passwordInput");
const passwordError = document.getElementById("passwordError");
const togglePassword = document.getElementById("togglePassword");
const countdown = document.getElementById("countdown");

const navToggle = document.getElementById("navToggle");
const nav = document.getElementById("nav");
const navLinks = document.querySelectorAll(".nav a");
const sectionsForNav = document.querySelectorAll("main section[id]");

const bgMusic = document.getElementById("bgMusic");
const musicToggleBtn = document.getElementById("musicToggleBtn");
const goodNightVideo = document.getElementById("goodNightVideo");

const imageModal = document.getElementById("imageModal");
const modalImage = document.getElementById("modalImage");
const closeImageModal = document.getElementById("closeImageModal");

const scrollToTopBtn = document.getElementById("scrollToTopBtn");

const brandSecret = document.getElementById("brandSecret");
const secretMessage = document.getElementById("secretMessage");
const heartRain = document.getElementById("heartRain");
const contractSecretTrigger = document.getElementById("contractSecretTrigger");
const playlistSecretTrigger = document.getElementById("playlistSecretTrigger");

const poemsContainer = document.getElementById("poemsContainer");
const voicesContainer = document.getElementById("voicesContainer");
const storyCardsContainer = document.getElementById("storyCardsContainer");
const timelineContainer = document.getElementById("timelineContainer");
const galleryContainer = document.getElementById("galleryContainer");
const reasonsContainer = document.getElementById("reasonsContainer");
const openWhenContainer = document.getElementById("openWhenContainer");
const loveStatsContainer = document.getElementById("loveStatsContainer");
const futurePlansContainer = document.getElementById("futurePlansContainer");
const finalLetter = document.getElementById("finalLetter");

let currentPoemAudio = null;
let currentPoemButton = null;
let bgMusicStarted = false;
let countdownInterval = null;
let secretClicks = 0;
let waitingAutoOpened = false;
let secretResetTimeout = null;
let currentVoiceAudio = null;
let currentVoiceElement = null;
let playlistPauseBound = false;
let siteConfigPromise = null;
let accessNotificationSent = false;
let secretHideTimeout = null;

/* ---------- HELPERS ---------- */
function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function pluralizeDays(value) {
    const absValue = Math.abs(value);
    const lastTwo = absValue % 100;
    const last = absValue % 10;

    if (lastTwo >= 11 && lastTwo <= 14) return "дней";
    if (last === 1) return "день";
    if (last >= 2 && last <= 4) return "дня";
    return "дней";
}

function getCalendarDayDiff(dateValue, mode = "since") {
    const targetDate = new Date(dateValue);
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const targetStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const dayMs = 1000 * 60 * 60 * 24;
    const diff = Math.floor((todayStart.getTime() - targetStart.getTime()) / dayMs);

    if (mode === "until") {
        return Math.max(Math.ceil((targetStart.getTime() - todayStart.getTime()) / dayMs), 0);
    }

    return Math.max(diff, 0);
}

function fallbackSiteConfig() {
    return {
        accessNotify: {
            enabled: false,
            endpoint: "",
            timeoutMs: 8000
        },
        security: {
            accessSecret: ""
        }
    };
}

async function fetchSiteConfig() {
    try {
        const response = await fetch("info.json", { cache: "no-store" });
        if (!response.ok) throw new Error("config");
        return await response.json();
    } catch {
        return fallbackSiteConfig();
    }
}

function getConnectionInfo() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

    if (!connection) return null;

    return {
        effectiveType: connection.effectiveType || "",
        downlink: connection.downlink || null,
        rtt: connection.rtt || null,
        saveData: Boolean(connection.saveData)
    };
}

async function getUserAgentDetails() {
    const uaData = navigator.userAgentData;

    if (!uaData) return null;

    const base = {
        brands: uaData.brands || [],
        mobile: Boolean(uaData.mobile),
        platform: uaData.platform || ""
    };

    if (typeof uaData.getHighEntropyValues !== "function") return base;

    try {
        const details = await uaData.getHighEntropyValues([
            "architecture",
            "bitness",
            "model",
            "platformVersion",
            "uaFullVersion"
        ]);

        return { ...base, ...details };
    } catch {
        return base;
    }
}

async function buildAccessNotificationPayload(accessState) {
    const uaDetails = await getUserAgentDetails();
    const now = new Date();

    return {
        type: "present_web_access",
        accessState,
        timestamp: now.toISOString(),
        localTime: now.toString(),
        page: {
            title: document.title,
            url: window.location.href,
            path: window.location.pathname,
            referrer: document.referrer || ""
        },
        device: {
            userAgent: navigator.userAgent || "",
            userAgentData: uaDetails,
            platform: navigator.platform || "",
            vendor: navigator.vendor || "",
            language: navigator.language || "",
            languages: navigator.languages || [],
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
            touchPoints: navigator.maxTouchPoints || 0,
            cookiesEnabled: navigator.cookieEnabled,
            connection: getConnectionInfo()
        },
        screen: {
            width: window.screen?.width || null,
            height: window.screen?.height || null,
            availWidth: window.screen?.availWidth || null,
            availHeight: window.screen?.availHeight || null,
            colorDepth: window.screen?.colorDepth || null,
            pixelRatio: window.devicePixelRatio || 1
        },
        viewport: {
            width: window.innerWidth,
            height: window.innerHeight
        }
    };
}

async function postJsonWithTimeout(url, body, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json"
            },
            body: JSON.stringify(body),
            keepalive: true,
            signal: controller.signal
        });
    } finally {
        clearTimeout(timeout);
    }
}

async function notifySuccessfulAccess(accessState) {
    if (accessNotificationSent) return;
    accessNotificationSent = true;

    const config = siteConfigPromise ? await siteConfigPromise : fallbackSiteConfig();
    const notify = config?.accessNotify || {};
    const endpoint = notify.endpoint || "";

    if (!notify.enabled || !endpoint) return;

    try {
        const payload = await buildAccessNotificationPayload(accessState);
        payload.security = {
            accessSecret: config?.security?.accessSecret || "",
            honeypot: ""
        };

        await postJsonWithTimeout(endpoint, payload, Number(notify.timeoutMs || 8000));
    } catch {
        // Notification must never block opening the gift.
    }
}

function getUiText(key, fallback = "") {
    if (typeof siteContent === "undefined") return fallback;
    return siteContent.ui?.[key] || fallback;
}

function setTextById(id, value) {
    const element = document.getElementById(id);

    if (!element || typeof value === "undefined") return;

    element.textContent = value;
}

function applySiteAssets() {
    if (typeof siteAssets === "undefined") return;

    const imageAssets = {
        brandLogo: siteAssets.logo,
        heroMainImage: siteAssets.heroMain,
        heroTopImage: siteAssets.heroTop,
        heroBottomImage: siteAssets.heroBottom,
        excitedImage: siteAssets.excitedPhoto,
        contractPage1Image: siteAssets.contractPage1,
        contractPage2Image: siteAssets.contractPage2
    };

    Object.entries(imageAssets).forEach(([id, source]) => {
        const image = document.getElementById(id);
        if (image && source) image.src = source;
    });

    const musicSource = document.getElementById("bgMusicSource");
    if (musicSource && siteAssets.backgroundMusic) {
        musicSource.src = siteAssets.backgroundMusic;
        bgMusic.load();
    }

    const videoSource = document.getElementById("goodNightVideoSource");
    if (goodNightVideo) {
        if (siteAssets.goodNightPoster) goodNightVideo.poster = siteAssets.goodNightPoster;
        if (videoSource && siteAssets.goodNightVideo) {
            videoSource.src = siteAssets.goodNightVideo;
            goodNightVideo.load();
        }
    }

    const playlistIframe = document.getElementById("playlistIframe");
    if (playlistIframe && siteAssets.yandexPlaylistUrl) {
        playlistIframe.src = siteAssets.yandexPlaylistUrl;
    }
}

function applySiteContent(mode = "initial") {
    if (typeof siteContent === "undefined") return;

    if (siteContent.page?.description) {
        const description = document.querySelector('meta[name="description"]');
        if (description) description.content = siteContent.page.description;
    }

    if (mode === "unlocked") {
        document.title = siteContent.page?.unlockedTitle || document.title;
    } else {
        document.title = siteContent.page?.initialTitle || document.title;
    }

    Object.entries(siteContent.texts || {}).forEach(([id, value]) => {
        setTextById(id, value);
    });

    if (passwordInput && siteContent.ui?.passwordPlaceholder) {
        passwordInput.placeholder = siteContent.ui.passwordPlaceholder;
    }

    if (togglePassword && siteContent.ui?.showPassword) {
        togglePassword.textContent = siteContent.ui.showPassword;
    }

    setTextById("passwordSubmitBtn", siteContent.ui?.openButton);
    setTextById("musicToggleBtn", siteContent.ui?.musicOn);
    setTextById("navToggleLabel", siteContent.ui?.navToggle);
}

function isSectionEnabled(sectionId) {
    if (typeof siteSettings === "undefined") return true;
    return siteSettings.sections?.[sectionId] !== false;
}

function toggleSectionVisibility(sectionId, isVisible) {
    const section = document.getElementById(sectionId);

    if (!section) return;

    section.hidden = !isVisible || !isSectionEnabled(sectionId);
}

function applyConfiguredSectionVisibility() {
    document.querySelectorAll("main section[id]").forEach((section) => {
        if (section.id !== "hero" && !isSectionEnabled(section.id)) {
            section.hidden = true;
        }
    });
}

function syncNavVisibility() {
    navLinks.forEach((link) => {
        const sectionId = link.getAttribute("href")?.replace("#", "");
        const section = sectionId ? document.getElementById(sectionId) : null;

        if (section) link.hidden = section.hidden;
    });
}

function stopCurrentPoemAudio() {
    if (currentPoemAudio) {
        currentPoemAudio.pause();
        currentPoemAudio.currentTime = 0;
    }

    if (currentPoemButton) {
        currentPoemButton.classList.remove("playing");
        currentPoemButton.textContent = getUiText("poemPlay", "Послушать моим голосом");
    }

    currentPoemAudio = null;
    currentPoemButton = null;
}

function stopCurrentVoiceAudio() {
    if (currentVoiceElement) {
        currentVoiceElement.pause();
        currentVoiceElement.currentTime = 0;
    }

    currentVoiceAudio = null;
    currentVoiceElement = null;
}

function stopAllManagedAudio() {
    stopCurrentPoemAudio();
    stopCurrentVoiceAudio();
}

function bindVoicePlayers() {
    document.querySelectorAll("#voicesContainer audio").forEach((audio) => {
        if (audio.dataset.bound === "true") return;
        audio.dataset.bound = "true";

        audio.addEventListener("play", () => {
            if (currentVoiceElement && currentVoiceElement !== audio) {
                currentVoiceElement.pause();
                currentVoiceElement.currentTime = 0;
            }

            stopCurrentPoemAudio();
            pauseBgMusic();

            currentVoiceElement = audio;
            currentVoiceAudio = audio;
        });

        audio.addEventListener("ended", () => {
            if (currentVoiceElement === audio) {
                currentVoiceElement = null;
                currentVoiceAudio = null;
            }
            resumeBgMusic();
        });

        audio.addEventListener("pause", () => {
            setTimeout(() => {
                const anyVoicePlaying = Array.from(document.querySelectorAll("#voicesContainer audio"))
                    .some((item) => !item.paused);

                if (!anyVoicePlaying && !currentPoemAudio) {
                    if (currentVoiceElement === audio) {
                        currentVoiceElement = null;
                        currentVoiceAudio = null;
                    }
                    resumeBgMusic();
                }
            }, 50);
        });
    });
}

function bindPlaylistPause() {
    if (playlistPauseBound) return;

    const playlistSection = document.getElementById("playlist");
    if (!playlistSection) return;

    playlistSection.addEventListener("pointerdown", (event) => {
        if (event.target.closest("iframe")) {
            stopAllManagedAudio();
            pauseBgMusic();
        }
    });

    playlistPauseBound = true;
}

function bindGoodNightVideo() {
    if (!goodNightVideo || goodNightVideo.dataset.bound === "true") return;
    goodNightVideo.dataset.bound = "true";

    goodNightVideo.addEventListener("play", () => {
        stopAllManagedAudio();
        pauseBgMusic();
    });

    goodNightVideo.addEventListener("pause", resumeBgMusic);
    goodNightVideo.addEventListener("ended", resumeBgMusic);
}

/* ---------- TEXT.JS SECTIONS ---------- */
function applyExcitedSectionTexts() {
    if (typeof excitedSectionTexts === "undefined") return;

    const title = document.getElementById("excitedTitle");
    const text = document.getElementById("excitedText");
    const caption = document.getElementById("excitedCaption");

    if (title) title.textContent = excitedSectionTexts.title || "";
    if (text) text.textContent = excitedSectionTexts.text || "";
    if (caption) caption.textContent = excitedSectionTexts.caption || "";
}

function applyRelationshipStats() {
    if (typeof relationshipStats === "undefined") return;

    const met = document.getElementById("heroDateMet");
    const relationship = document.getElementById("heroDateRelationship");
    const statLabel = document.getElementById("heroStatLabel");
    const statValue = document.getElementById("heroStatValue");

    if (met) met.textContent = relationshipStats.dateMet || "";
    if (relationship) relationship.textContent = relationshipStats.relationshipStarted || "";
    if (statLabel) statLabel.textContent = relationshipStats.heroLabel || "";
    if (statValue) statValue.textContent = relationshipStats.heroValue || "";
}

function renderStoryCards() {
    if (!storyCardsContainer || typeof storyCardsData === "undefined") return;

    toggleSectionVisibility("story-start", storyCardsData.length > 0);

    storyCardsContainer.innerHTML = storyCardsData.map((item) => {
        const imageClass = item.imageClass ? ` class="${escapeHtml(item.imageClass)}"` : "";

        return `
            <article class="story-card reveal">
                <div class="story-image">
                    <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt || "")}"${imageClass} />
                </div>
                <div class="story-card-body">
                    <h3>${escapeHtml(item.title)}</h3>
                    <p>${escapeHtml(item.text)}</p>
                </div>
            </article>
        `;
    }).join("");
}

function renderTimeline() {
    if (!timelineContainer || typeof timelineData === "undefined") return;

    toggleSectionVisibility("timeline", timelineData.length > 0);

    timelineContainer.innerHTML = timelineData.map((item) => {
        return `
            <article class="timeline-item reveal">
                <div class="timeline-dot"></div>
                <div class="timeline-content">
                    <span class="timeline-date">${escapeHtml(item.date)}</span>
                    <h3>${escapeHtml(item.title)}</h3>
                    <p>${escapeHtml(item.text)}</p>
                </div>
            </article>
        `;
    }).join("");
}

function renderReasons() {
    if (!reasonsContainer || typeof reasonsData === "undefined") return;

    toggleSectionVisibility("reasons", reasonsData.length > 0);

    reasonsContainer.innerHTML = reasonsData.map((item) => {
        return `
            <article class="reason-card reveal">
                <h3>${escapeHtml(item.title)}</h3>
                <p>${escapeHtml(item.text)}</p>
            </article>
        `;
    }).join("");
}

function renderOpenWhenLetters() {
    if (!openWhenContainer || typeof openWhenData === "undefined") return;

    toggleSectionVisibility("open-when", openWhenData.length > 0);

    openWhenContainer.innerHTML = openWhenData.map((item) => {
        const paragraphs = item.paragraphs.map((paragraph) => {
            return `<p>${escapeHtml(paragraph)}</p>`;
        }).join("");

        return `
            <article class="open-when-card reveal">
                <button class="open-when-toggle" type="button" aria-expanded="false">
                    <span>${escapeHtml(item.title)}</span>
                    <span class="open-when-action">${escapeHtml(item.button || getUiText("openLetter", "Открыть письмо"))}</span>
                </button>
                <div class="open-when-body">
                    ${paragraphs}
                </div>
            </article>
        `;
    }).join("");
}

function bindOpenWhenLetters() {
    document.querySelectorAll(".open-when-toggle").forEach((button) => {
        if (button.dataset.bound === "true") return;
        button.dataset.bound = "true";

        button.addEventListener("click", () => {
            const card = button.closest(".open-when-card");
            const isOpen = card.classList.toggle("open");
            const action = button.querySelector(".open-when-action");

            button.setAttribute("aria-expanded", String(isOpen));
            if (action) action.textContent = isOpen
                ? getUiText("closeLetter", "Свернуть")
                : getUiText("openLetter", "Открыть письмо");
        });
    });
}

function renderLoveStats() {
    if (!loveStatsContainer || typeof loveStatsData === "undefined") return;

    toggleSectionVisibility("love-stats", loveStatsData.length > 0);

    loveStatsContainer.innerHTML = loveStatsData.map((item) => {
        const days = getCalendarDayDiff(item.date, item.mode);
        const note = item.mode === "until" && days === 0
            ? getUiText("loveStatsFinishedNote", "новая глава уже открыта")
            : item.note;

        return `
            <article class="love-stat-card reveal">
                <span class="love-stat-label">${escapeHtml(item.label)}</span>
                <strong class="love-stat-number">${days}</strong>
                <span class="love-stat-unit">${pluralizeDays(days)}</span>
                <p>${escapeHtml(note)}</p>
            </article>
        `;
    }).join("");
}

function renderFuturePlans() {
    if (!futurePlansContainer || typeof futurePlansData === "undefined") return;

    toggleSectionVisibility("future-plans", futurePlansData.length > 0);

    futurePlansContainer.innerHTML = futurePlansData.map((item) => {
        return `
            <article class="future-card reveal">
                <h3>${escapeHtml(item.title)}</h3>
                <p>${escapeHtml(item.text)}</p>
            </article>
        `;
    }).join("");
}

function renderFinalLetter() {
    if (!finalLetter || typeof finalLetterData === "undefined") return;

    const paragraphsData = finalLetterData.paragraphs || [];
    const hasLetter = Boolean(finalLetterData.title || paragraphsData.length);
    finalLetter.hidden = !hasLetter;
    if (!hasLetter) return;

    const paragraphs = paragraphsData.map((paragraph) => {
        return `<p>${escapeHtml(paragraph)}</p>`;
    }).join("");

    finalLetter.innerHTML = `
        <h3>${escapeHtml(finalLetterData.title)}</h3>
        ${paragraphs}
    `;
}

function renderGallery() {
    if (!galleryContainer || typeof galleryData === "undefined") return;

    toggleSectionVisibility("gallery", galleryData.length > 0);

    galleryContainer.innerHTML = galleryData.map((item) => {
        const classes = item.tall ? "gallery-card tall reveal" : "gallery-card reveal";

        return `
            <figure class="${classes}" data-full="${escapeHtml(item.full || item.image)}">
                <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.alt || "")}" />
                <figcaption>${escapeHtml(item.caption)}</figcaption>
            </figure>
        `;
    }).join("");
}

function renderPoems() {
    if (!poemsContainer || typeof poemsData === "undefined") return;

    toggleSectionVisibility("poems", poemsData.length > 0);

    poemsContainer.innerHTML = poemsData.map((poem) => {
        const poemHtml = poem.lines.map((line) => {
            if (line === "") return "<br />";
            return `<p>${escapeHtml(line)}</p>`;
        }).join("");

        return `
            <article class="poem-card reveal">
                <h3>${escapeHtml(poem.title)}</h3>
                <div class="poem-body">
                    ${poemHtml}
                </div>
                <div class="poem-audio">
                    <button class="audio-button" data-audio="${escapeHtml(poem.audio)}" type="button">
                        ${escapeHtml(getUiText("poemPlay", "Послушать моим голосом"))}
                    </button>
                </div>
            </article>
        `;
    }).join("");
}

function renderVoiceNotes() {
    if (!voicesContainer || typeof voiceNotesData === "undefined") return;

    toggleSectionVisibility("voices", voiceNotesData.length > 0);

    voicesContainer.innerHTML = voiceNotesData.map((item) => {
        return `
            <article class="voice-card reveal">
                <h3>${escapeHtml(item.title)}</h3>
                <p>${escapeHtml(item.text)}</p>
                <audio controls preload="none">
                    <source src="${escapeHtml(item.audio)}" type="audio/ogg" />
                </audio>
            </article>
        `;
    }).join("");
}

function bindPoemAudioButtons() {
    document.querySelectorAll(".audio-button").forEach((button) => {
        if (button.dataset.bound === "true") return;
        button.dataset.bound = "true";

        button.addEventListener("click", () => {
            const audioPath = button.dataset.audio;
            if (!audioPath) return;

            if (currentPoemButton === button && currentPoemAudio && !currentPoemAudio.paused) {
                stopCurrentPoemAudio();
                resumeBgMusic();
                return;
            }

            stopCurrentVoiceAudio();
            stopCurrentPoemAudio();
            pauseBgMusic();

            const poemAudio = new Audio(audioPath);
            currentPoemAudio = poemAudio;
            currentPoemButton = button;

            button.classList.add("playing");
            button.textContent = getUiText("poemStop", "Остановить запись");

            poemAudio.play().catch(() => {
                stopCurrentPoemAudio();
                resumeBgMusic();
            });

            poemAudio.addEventListener("ended", () => {
                stopCurrentPoemAudio();
                resumeBgMusic();
            });
        });
    });
}


/* ---------- ACCESS ---------- */
function showEntryScreen() {
    entryScreen.classList.add("active");
    waitingScreen.classList.remove("active");
    site.classList.remove("active");
    waitingScreen.setAttribute("aria-hidden", "true");
    site.setAttribute("aria-hidden", "true");
}

function showWaitingScreen() {
    entryScreen.classList.remove("active");
    waitingScreen.classList.add("active");
    site.classList.remove("active");
    waitingScreen.setAttribute("aria-hidden", "false");
    site.setAttribute("aria-hidden", "true");
    startCountdown();
}

function showSite() {
    entryScreen.classList.remove("active");
    waitingScreen.classList.remove("active");
    site.classList.add("active");
    waitingScreen.setAttribute("aria-hidden", "true");
    site.setAttribute("aria-hidden", "false");

    applySiteContent("unlocked");

    unlockFavicon();
    applyExcitedSectionTexts();
    applyRelationshipStats();
    renderStoryCards();
    renderTimeline();
    renderReasons();
    renderOpenWhenLetters();
    bindOpenWhenLetters();
    renderLoveStats();
    renderFuturePlans();
    renderFinalLetter();
    renderGallery();
    renderPoems();
    renderVoiceNotes();
    applyConfiguredSectionVisibility();
    syncNavVisibility();
    bindVoicePlayers();
    bindPoemAudioButtons();
    bindPlaylistPause();
    bindGoodNightVideo();
    initGalleryModal();
    observeReveal();
    setActiveNavLink();
}

function unlockFavicon() {
    let favicon = document.querySelector('link[rel="icon"]');

    if (!favicon) {
        favicon = document.createElement("link");
        favicon.rel = "icon";
        document.head.appendChild(favicon);
    }

    const faviconPath = typeof siteAssets !== "undefined" && siteAssets.favicon
        ? siteAssets.favicon
        : "image/base/favicon-unlocked.ico";
    favicon.href = `${faviconPath}?v=${Date.now()}`;
}

passwordForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    const value = passwordInput.value.trim();

    if (value !== PASSWORD) {
        passwordError.textContent = getUiText("passwordError", "Неверный пароль.");
        return;
    }

    passwordError.textContent = "";

    const now = new Date();
    const dateLockActive = typeof siteSettings !== "undefined"
        && siteSettings.lockEnabled !== false
        && Number.isFinite(OPEN_DATE.getTime())
        && now < OPEN_DATE;
    const accessState = dateLockActive ? "waiting_screen" : "site_opened";
    notifySuccessfulAccess(accessState);

    if (dateLockActive) {
        showWaitingScreen();
    } else {
        showSite();
    }
});

togglePassword?.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";

    passwordInput.type = isHidden ? "text" : "password";
    togglePassword.textContent = isHidden
        ? getUiText("hidePassword", "Скрыть")
        : getUiText("showPassword", "Показать");
    togglePassword.setAttribute(
        "aria-label",
        isHidden ? getUiText("hidePassword", "Скрыть пароль") : getUiText("showPassword", "Показать пароль")
    );
});

function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    function updateCountdown() {
        const now = new Date();
        const diff = OPEN_DATE.getTime() - now.getTime();
        if (diff <= 0) {
            countdown.textContent = getUiText("countdownReady", "Время пришло.");
            if (!waitingAutoOpened) {
                waitingAutoOpened = true;
                clearInterval(countdownInterval);
                setTimeout(() => {
                    waitingScreen.classList.add("fade-out");
                    setTimeout(() => {
                        showSite();
                        waitingScreen.classList.remove("fade-out");
                    }, 900);
                }, 3000);
            }
            return;
        }
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        countdown.textContent = [
            `${days} ${getUiText("dayShort", "д")}`,
            `${hours} ${getUiText("hourShort", "ч")}`,
            `${minutes} ${getUiText("minuteShort", "м")}`,
            `${seconds} ${getUiText("secondShort", "с")}`
        ].join(" ");
    }
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
}

/* ---------- NAV ---------- */
navToggle?.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
});

document.querySelectorAll(".nav a").forEach((link) => {
    link.addEventListener("click", () => {
        nav.classList.remove("open");
        navToggle?.setAttribute("aria-expanded", "false");
    });
});

document.addEventListener("pointerdown", (event) => {
    if (!nav?.classList.contains("open")) return;
    if (nav.contains(event.target) || navToggle?.contains(event.target)) return;

    nav.classList.remove("open");
    navToggle?.setAttribute("aria-expanded", "false");
});

function setActiveNavLink() {
    let currentSectionId = "";

    sectionsForNav.forEach((section) => {
        if (section.hidden) return;

        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;

        if (window.scrollY >= sectionTop - 140 && window.scrollY < sectionTop + sectionHeight - 140) {
            currentSectionId = section.getAttribute("id");
        }
    });

    navLinks.forEach((link) => {
        const href = link.getAttribute("href")?.replace("#", "");
        if (href === currentSectionId) {
            link.classList.add("active");
        } else {
            link.classList.remove("active");
        }
    });
}

window.addEventListener("scroll", setActiveNavLink);
window.addEventListener("load", setActiveNavLink);

/* ---------- REVEAL ---------- */
function observeReveal() {
    const elements = document.querySelectorAll(".reveal:not(.in-view)");

    if (IS_LOCAL_PREVIEW) {
        elements.forEach((element) => element.classList.add("in-view"));
        return;
    }

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("in-view");
                    observer.unobserve(entry.target);
                }
            });
        },
        {
            threshold: 0.16
        }
    );

    elements.forEach((element) => observer.observe(element));
}

/* ---------- MUSIC ---------- */
async function startBgMusic() {
    try {
        await bgMusic.play();
        bgMusicStarted = true;
        musicToggleBtn.textContent = getUiText("musicOff", "Выключить музыку");
    } catch (error) {
        musicToggleBtn.textContent = getUiText("musicOn", "Включить музыку");
    }
}

function pauseBgMusic() {
    bgMusic.pause();
    musicToggleBtn.textContent = getUiText("musicOn", "Включить музыку");
}

function resumeBgMusic() {
    const anyVoicePlaying = Array.from(document.querySelectorAll("#voicesContainer audio"))
        .some((item) => !item.paused);

    if (bgMusicStarted && !currentPoemAudio && !anyVoicePlaying) {
        bgMusic.play().catch(() => { });
        musicToggleBtn.textContent = getUiText("musicOff", "Выключить музыку");
    }
}

musicToggleBtn?.addEventListener("click", async () => {
    if (bgMusic.paused) {
        await startBgMusic();
    } else {
        pauseBgMusic();
    }
});

/* ---------- IMAGE MODAL ---------- */
function openImageViewer(full) {
    modalImage.src = full;
    imageModal.classList.add("active");
    imageModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}

function closeImageViewer() {
    imageModal.classList.remove("active");
    imageModal.setAttribute("aria-hidden", "true");
    modalImage.removeAttribute("src");
    document.body.classList.remove("modal-open");
}

function initGalleryModal() {
    document.querySelectorAll(".gallery-card").forEach((card) => {
        if (card.dataset.bound === "true") return;
        card.dataset.bound = "true";

        card.addEventListener("click", () => {
            const full = card.dataset.full;
            if (!full) return;
            openImageViewer(full);
        });
    });
}

closeImageModal?.addEventListener("click", closeImageViewer);
imageModal?.addEventListener("click", (event) => {
    if (event.target === imageModal) closeImageViewer();
});

/* ---------- SCROLL TO TOP ---------- */
scrollToTopBtn?.addEventListener("click", () => {
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
});

/* ---------- SECRET PHRASE + HEARTS ---------- */
function spawnHeart() {
    const heart = document.createElement("span");
    heart.className = "heart";
    heart.textContent = Math.random() > 0.5 ? "♡" : "♥";
    heart.style.left = `${Math.random() * 100}%`;
    heart.style.animationDuration = `${3 + Math.random() * 3}s`;
    heart.style.fontSize = `${16 + Math.random() * 20}px`;
    heartRain.appendChild(heart);

    setTimeout(() => heart.remove(), 6500);
}

function triggerSecret(kicker, message) {
    const secretKicker = document.getElementById("secretKicker");
    const secretText = document.getElementById("secretText");

    if (secretKicker && kicker) secretKicker.textContent = kicker;
    if (secretText && message) secretText.textContent = message;

    clearTimeout(secretHideTimeout);
    secretMessage.classList.add("active");
    secretMessage.setAttribute("aria-hidden", "false");

    for (let i = 0; i < 24; i += 1) {
        setTimeout(spawnHeart, i * 90);
    }

    secretHideTimeout = setTimeout(() => {
        secretMessage.classList.remove("active");
        secretMessage.setAttribute("aria-hidden", "true");
    }, 3600);
}

function bindClickSecret(element, clickTarget, callback) {
    if (!element) return;

    let clicks = 0;
    let resetTimeout = null;

    element.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        clicks += 1;

        clearTimeout(resetTimeout);
        resetTimeout = setTimeout(() => {
            clicks = 0;
        }, 1800);

        if (clicks < clickTarget) return;

        clicks = 0;
        clearTimeout(resetTimeout);
        callback();
    });
}

brandSecret?.addEventListener("click", (event) => {
    event.preventDefault();

    secretClicks += 1;

    clearTimeout(secretResetTimeout);
    secretResetTimeout = setTimeout(() => {
        secretClicks = 0;
    }, 1600);

    if (secretClicks >= 3) {
        secretClicks = 0;
        triggerSecret(
            siteContent.texts?.secretKicker,
            siteContent.texts?.secretText
        );
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }
});

bindClickSecret(contractSecretTrigger, 3, () => {
    triggerSecret(
        siteContent.texts?.contractSecretKicker,
        siteContent.texts?.contractSecretText
    );
});

bindClickSecret(playlistSecretTrigger, 3, () => {
    triggerSecret(
        siteContent.texts?.playlistSecretKicker,
        siteContent.texts?.playlistSecretText
    );
});

/* ---------- ESC ---------- */
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeImageViewer();
        nav.classList.remove("open");
        navToggle?.setAttribute("aria-expanded", "false");
    }
});

/* ---------- INIT ---------- */
siteConfigPromise = fetchSiteConfig();
applySiteAssets();
applySiteContent();
if (IS_LOCAL_PREVIEW) {
    showSite();
} else {
    showEntryScreen();
}
