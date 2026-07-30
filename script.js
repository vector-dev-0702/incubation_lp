const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Existing scroll-reveal */
const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add("show");
            observer.unobserve(entry.target);
        }
    });
}, {
    threshold: 0.25
});

document.querySelectorAll(".fade-up").forEach(el => {
    observer.observe(el);
});

/* Mark first-view CTAs ready after entrance so hover/breathe can own transform */
function armAnimReady(el) {
    const enable = () => {
        if (!el.classList.contains("anim-ready")) {
            el.classList.add("anim-ready");
        }
    };
    el.addEventListener("animationend", (event) => {
        if (event.target === el && event.animationName === "fadeUp") {
            enable();
        }
    });
    window.setTimeout(enable, 2600);
}

document.querySelectorAll(".first-section .pc-hero-cta .span-btns span, .first-section .pc-hero-cta .hero-cta-btn")
    .forEach(armAnimReady);

/* ------------------------------------------------------------
   Fixed logo — hover burst with graceful fade-out
   ------------------------------------------------------------ */
(function initLogoMotion() {
    if (prefersReducedMotion) return;

    const wrap = document.querySelector(".bg-logo-wrapper");
    const img = wrap?.querySelector("img");
    if (!wrap || !img) return;

    let fadeTimer = 0;

    const heat = () => {
        window.clearTimeout(fadeTimer);
        wrap.classList.remove("is-logo-fading");
        wrap.classList.add("is-logo-hot");
    };

    const cool = () => {
        wrap.classList.remove("is-logo-hot");
        wrap.classList.add("is-logo-fading");
        fadeTimer = window.setTimeout(() => {
            wrap.classList.remove("is-logo-fading");
        }, 1100);
    };

    wrap.addEventListener("mouseenter", heat);
    wrap.addEventListener("mouseleave", cool);
    img.addEventListener("focus", heat);
    img.addEventListener("blur", cool);
})();

/* ------------------------------------------------------------
   Heading gear — accelerate on heading hover, ease out on leave
   ------------------------------------------------------------ */
(function initHeadingGear() {
    if (prefersReducedMotion) return;

    const trigger = document.querySelector("[data-gear-trigger]");
    const gear = document.querySelector(".heading-gear");
    if (!trigger || !gear) return;

    let outTimer = 0;

    trigger.addEventListener("mouseenter", () => {
        window.clearTimeout(outTimer);
        gear.classList.remove("is-gear-easing");
        gear.classList.add("is-gear-hot");
    });

    trigger.addEventListener("mouseleave", () => {
        gear.classList.remove("is-gear-hot");
        gear.classList.add("is-gear-easing");
        outTimer = window.setTimeout(() => {
            gear.classList.remove("is-gear-easing");
        }, 900);
    });
})();

/* ------------------------------------------------------------
   Unified flow strips — seamless marquee + scroll acceleration
   ------------------------------------------------------------ */
(function initFlowMarquees() {
    if (prefersReducedMotion) return;

    const marquees = Array.from(document.querySelectorAll(
        ".hero-bg > .top-strip .flow-marquee, .hero-bg > .bottom-strip .flow-marquee, .first-section > .bottom-strip .flow-marquee, .incubation-band .flow-marquee"
    ));
    if (!marquees.length) return;

    const IDLE_CYCLE_MS = 26000;
    const BOOST_MULTIPLIER = 7.5;
    const SPEED_LERP_UP = 0.14;
    const SPEED_LERP_DOWN = 0.045;
    const BOOST_HOLD_MS = 420;

    const tracks = marquees.map(root => {
        const inner = root.querySelector(".flow-marquee__inner");
        const chunk = root.querySelector(".flow-marquee__chunk");
        const flow = root.getAttribute("data-flow");
        /* up ≈ along diagonal toward top (local +X); down ≈ opposite */
        const flowsRight = flow === "right" || flow === "up";
        return { inner, chunk, flowsRight, offset: 0, segWidth: 0 };
    });

    let idleSpeed = 0;
    let currentSpeed = 0;
    let targetSpeed = 0;
    let boostTimer = 0;
    let lastTs = 0;
    let running = true;

    function measure() {
        let referenceWidth = 0;
        for (const track of tracks) {
            if (!track.chunk) continue;
            /* offsetWidth = layout width along the track (correct under parent rotate) */
            track.segWidth = track.chunk.offsetWidth || track.chunk.getBoundingClientRect().width;
            if (!referenceWidth && track.segWidth) referenceWidth = track.segWidth;
        }
        if (!referenceWidth) return;
        idleSpeed = referenceWidth / IDLE_CYCLE_MS;
        if (currentSpeed === 0) currentSpeed = idleSpeed;
        if (targetSpeed === 0) targetSpeed = idleSpeed;
    }

    measure();
    window.addEventListener("resize", measure, { passive: true });

    function onScrollIntent() {
        if (!idleSpeed) measure();
        targetSpeed = idleSpeed * BOOST_MULTIPLIER;
        window.clearTimeout(boostTimer);
        boostTimer = window.setTimeout(() => {
            targetSpeed = idleSpeed;
        }, BOOST_HOLD_MS);
    }

    const main = document.querySelector("main");
    const wheelOpts = { passive: true };
    window.addEventListener("wheel", onScrollIntent, wheelOpts);
    if (main) {
        main.addEventListener("wheel", onScrollIntent, wheelOpts);
        main.addEventListener("scroll", onScrollIntent, { passive: true });
    }

    function frame(ts) {
        if (!running) return;
        if (!lastTs) lastTs = ts;
        const dt = Math.min(32, ts - lastTs);
        lastTs = ts;

        if (!idleSpeed) measure();

        const lerp = currentSpeed < targetSpeed ? SPEED_LERP_UP : SPEED_LERP_DOWN;
        currentSpeed += (targetSpeed - currentSpeed) * lerp;

        const delta = currentSpeed * dt;

        for (const track of tracks) {
            if (!track.segWidth) continue;

            track.offset += delta;
            if (track.offset >= track.segWidth) {
                track.offset -= track.segWidth;
            }

            const x = track.flowsRight
                ? track.offset - track.segWidth
                : -track.offset;

            track.inner.style.transform = `translate3d(${x}px, 0, 0)`;
        }

        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            running = false;
            lastTs = 0;
        } else {
            running = true;
            requestAnimationFrame(frame);
        }
    });
})();
