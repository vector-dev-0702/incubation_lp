const observer = new IntersectionObserver((entries, observer) => {

    entries.forEach(entry => {

        if(entry.isIntersecting){
            entry.target.classList.add("show");
            observer.unobserve(entry.target);
        }

    });

}, {
    threshold:0.25
});

document.querySelectorAll(".fade-up").forEach(el=>{
    observer.observe(el);
});

/* Shared scroll-reactive velocity (calm base → boost on scroll → soft decelerate) */
const createScrollVelocity = ({
    base = 0.35,
    boost = 2.4,
    lerp = 0.08,
    idleMs = 180,
} = {}) => {
    let velocity = base;
    let targetVelocity = base;
    let idleTimer = null;

    const boostNow = () => {
        targetVelocity = boost;
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            targetVelocity = base;
        }, idleMs);
    };

    const tick = () => {
        velocity += (targetVelocity - velocity) * lerp;
        return velocity;
    };

    const bind = (scroller) => {
        scroller.addEventListener("wheel", boostNow, { passive: true });
        scroller.addEventListener("scroll", boostNow, { passive: true });
        scroller.addEventListener("touchmove", boostNow, { passive: true });
    };

    return { tick, bind, boostNow };
};

const getMainScroller = () => document.querySelector("main") || window;

/* Flow-section diagonal band marquee (scoped) */
(() => {
    const section = document.querySelector(".flow-section");
    if (!section) return;

    const rails = section.querySelectorAll(".flow-strip__rail");
    if (!rails.length) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const velocity = createScrollVelocity({
        base: 0.35,
        boost: 2.4,
        lerp: 0.08,
        idleMs: 160,
    });

    let offset = 0;
    let seqWidth = 0;

    const measure = () => {
        const seq = section.querySelector(".flow-strip__seq");
        seqWidth = seq ? seq.offsetWidth : 0;
    };

    const frame = () => {
        const v = velocity.tick();
        if (seqWidth > 0) {
            offset = (offset + v) % seqWidth;
            const t = `translate3d(${-offset}px, 0, 0)`;
            rails.forEach((rail) => {
                rail.style.transform = t;
            });
        }
        requestAnimationFrame(frame);
    };

    measure();
    window.addEventListener("resize", measure, { passive: true });

    velocity.bind(getMainScroller());

    requestAnimationFrame(frame);
})();

/* Top / bottom Incubation bands — opposite directions, scroll-reactive */
(() => {
    const topStrips = Array.from(document.querySelectorAll(".top-strip"));
    const bottomStrips = Array.from(document.querySelectorAll(".bottom-strip"));
    if (!topStrips.length && !bottomStrips.length) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;

    const velocity = createScrollVelocity({
        base: 0.28,
        boost: 2.1,
        lerp: 0.07,
        idleMs: 200,
    });

    let offset = 0;
    let tileWidth = 0;

    const measureTile = () => {
        const probe = topStrips[0] || bottomStrips[0];
        if (!probe) return;

        const bg = getComputedStyle(probe).backgroundImage;
        const match = bg && bg.match(/url\(["']?(.*?)["']?\)/);
        if (!match) return;

        const img = new Image();
        img.onload = () => {
            const h = probe.offsetHeight || 28;
            const scale = h / (img.naturalHeight || h);
            tileWidth = (img.naturalWidth || 200) * scale;
        };
        img.src = match[1];
    };

    const frame = () => {
        const v = velocity.tick();
        offset += v;

        const mod = tileWidth > 0 ? tileWidth : 240;
        const topPos = -((offset % mod) + mod) % mod;
        const bottomPos = ((offset % mod) + mod) % mod;

        /* Top ←←←  /  Bottom →→→ */
        topStrips.forEach((el) => {
            el.style.backgroundPosition = `${topPos}px 0`;
        });
        bottomStrips.forEach((el) => {
            el.style.backgroundPosition = `${bottomPos}px 0`;
        });

        requestAnimationFrame(frame);
    };

    measureTile();
    window.addEventListener("resize", measureTile, { passive: true });

    velocity.bind(getMainScroller());

    requestAnimationFrame(frame);
})();

/* =========================================================
   Assignment 2 — Desktop drag scrolling (mobile-like on main)
   Drag up → scroll down / Drag down → scroll up
   Does not replace wheel, touchpad, keyboard, or touch scroll
   ========================================================= */
(() => {
    const main = document.querySelector("main");
    if (!main) return;

    const desktopMq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const isDesktopPointer = () => desktopMq.matches;

    const INTERACTIVE = "button, a, input, textarea, select, label, [role='button']";

    let active = false;
    let moved = false;
    let startY = 0;
    let startScroll = 0;
    let lastY = 0;
    let lastT = 0;
    let velY = 0; // finger px / ms
    let inertiaRaf = null;

    const stopInertia = () => {
        if (inertiaRaf) {
            cancelAnimationFrame(inertiaRaf);
            inertiaRaf = null;
        }
    };

    const runInertia = (scrollVel) => {
        stopInertia();
        let v = scrollVel;

        const step = () => {
            if (Math.abs(v) < 0.05) {
                inertiaRaf = null;
                return;
            }
            main.scrollTop += v;
            v *= 0.94; // soft deceleration
            inertiaRaf = requestAnimationFrame(step);
        };

        inertiaRaf = requestAnimationFrame(step);
    };

    const endDrag = () => {
        if (!active) return;
        active = false;
        main.classList.remove("is-drag-scrolling");
        document.body.style.removeProperty("cursor");

        if (moved) {
            // Finger up (negative velY) → content moves up → scrollTop increases
            runInertia(-velY * 14);
        }
        moved = false;
    };

    main.addEventListener("mousedown", (e) => {
        if (!isDesktopPointer()) return;
        if (e.button !== 0) return;
        if (e.target.closest(INTERACTIVE)) return;

        stopInertia();
        active = true;
        moved = false;
        startY = e.clientY;
        startScroll = main.scrollTop;
        lastY = e.clientY;
        lastT = performance.now();
        velY = 0;

        main.classList.add("is-drag-scrolling");
        document.body.style.cursor = "grabbing";
        e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
        if (!active) return;

        const dy = e.clientY - startY;
        if (Math.abs(dy) > 3) moved = true;

        // Drag up → page scrolls down (like pushing a phone screen)
        main.scrollTop = startScroll - dy;

        const now = performance.now();
        const dt = Math.max(8, now - lastT);
        velY = (e.clientY - lastY) / dt;
        lastY = e.clientY;
        lastT = now;
    });

    window.addEventListener("mouseup", endDrag);
    window.addEventListener("blur", endDrag);

    // Prevent native image drag ghost while interacting with the column
    main.addEventListener("dragstart", (e) => {
        if (isDesktopPointer()) e.preventDefault();
    });
})();
