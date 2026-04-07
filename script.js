const PASSWORD = "18.02.2026-22:19";
const OPEN_DATE = new Date("2026-04-08T01:00:00");

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

const imageModal = document.getElementById("imageModal");
const modalImage = document.getElementById("modalImage");
const closeImageModal = document.getElementById("closeImageModal");

const scrollToTopBtn = document.getElementById("scrollToTopBtn");

const brandSecret = document.getElementById("brandSecret");
const secretMessage = document.getElementById("secretMessage");
const heartRain = document.getElementById("heartRain");

const poemsContainer = document.getElementById("poemsContainer");
const voicesContainer = document.getElementById("voicesContainer");
const timelineContainer = document.getElementById("timelineContainer");

let currentPoemAudio = null;
let currentPoemButton = null;
let bgMusicStarted = false;
let countdownInterval = null;
let secretClicks = 0;
let waitingAutoOpened = false;
let secretResetTimeout = null;
let currentVoiceAudio = null;
let currentVoiceElement = null;
let currentPlaylistIframe = null;
let playlistPauseBound = false;

/* ---------- HELPERS ---------- */
function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}
function stopCurrentPoemAudio() {
    if (currentPoemAudio) {
        currentPoemAudio.pause();
        currentPoemAudio.currentTime = 0;
    }

    if (currentPoemButton) {
        currentPoemButton.classList.remove("playing");
        currentPoemButton.textContent = "Послушать моим голосом";
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

function renderTimeline() {
    if (!timelineContainer || typeof timelineData === "undefined") return;

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

function renderPoems() {
    if (!poemsContainer || typeof poemsData === "undefined") return;

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
                        Послушать моим голосом
                    </button>
                </div>
            </article>
        `;
    }).join("");
}

function renderVoiceNotes() {
    if (!voicesContainer || typeof voiceNotesData === "undefined") return;

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
            button.textContent = "Остановить запись";

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

    document.title = "Хомячок × Зайка ♡";

    unlockFavicon();
    applyExcitedSectionTexts();
    applyRelationshipStats();
    renderTimeline();
    renderPoems();
    renderVoiceNotes();
    bindVoicePlayers();
    bindPoemAudioButtons();
    bindPlaylistPause();
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

    favicon.href = `image/base/favicon-unlocked.ico?v=${Date.now()}`;
}

passwordForm?.addEventListener("submit", (event) => {
    event.preventDefault();

    const value = passwordInput.value.trim();

    if (value !== PASSWORD) {
        passwordError.textContent = "Неверный пароль.";
        return;
    }

    passwordError.textContent = "";

    const now = new Date();

    if (now < OPEN_DATE) {
        showWaitingScreen();
    } else {
        showSite();
    }
});

togglePassword?.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";

    passwordInput.type = isHidden ? "text" : "password";
    togglePassword.textContent = isHidden ? "Скрыть" : "Показать";
    togglePassword.setAttribute("aria-label", isHidden ? "Скрыть пароль" : "Показать пароль");
});

function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    function updateCountdown() {
        const now = new Date();
        const diff = OPEN_DATE.getTime() - now.getTime();
        if (diff <= 0) {
            countdown.textContent = "Время пришло.";
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
        countdown.textContent = `${days} д ${hours} ч ${minutes} м ${seconds} с`;
    }
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
}

/* ---------- NAV ---------- */
navToggle?.addEventListener("click", () => {
    nav.classList.toggle("open");
});

document.querySelectorAll(".nav a").forEach((link) => {
    link.addEventListener("click", () => {
        nav.classList.remove("open");
    });
});

function setActiveNavLink() {
    let currentSectionId = "";

    sectionsForNav.forEach((section) => {
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
        musicToggleBtn.textContent = "Выключить музыку";
    } catch (error) {
        musicToggleBtn.textContent = "Включить музыку";
    }
}

function pauseBgMusic() {
    bgMusic.pause();
    musicToggleBtn.textContent = "Включить музыку";
}

function resumeBgMusic() {
    const anyVoicePlaying = Array.from(document.querySelectorAll("#voicesContainer audio"))
        .some((item) => !item.paused);

    if (bgMusicStarted && !currentPoemAudio && !anyVoicePlaying) {
        bgMusic.play().catch(() => { });
        musicToggleBtn.textContent = "Выключить музыку";
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
    modalImage.src = "";
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

function triggerSecret() {
    secretMessage.classList.add("active");
    secretMessage.setAttribute("aria-hidden", "false");

    for (let i = 0; i < 24; i += 1) {
        setTimeout(spawnHeart, i * 90);
    }

    setTimeout(() => {
        secretMessage.classList.remove("active");
        secretMessage.setAttribute("aria-hidden", "true");
    }, 3600);
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
        triggerSecret();
        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }
});

/* ---------- ESC ---------- */
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        closeImageViewer();
        nav.classList.remove("open");
    }
});

/* ---------- INIT ---------- */
showEntryScreen();