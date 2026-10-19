export const LANDING_REVEAL_VISIBLE_CLASS = 'landing-reveal--visible';

const REVEAL_ON_LOAD_DELAY_MS = 120;

export function setupLandingReveal(
    root: HTMLElement,
    observer?: IntersectionObserver
): IntersectionObserver {
    const revealObserver =
        observer ??
        new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;

                    entry.target.classList.add(LANDING_REVEAL_VISIBLE_CLASS);
                    revealObserver.unobserve(entry.target);
                });
            },
            { threshold: 0.08, rootMargin: '0px 0px -4% 0px' }
        );

    root.querySelectorAll<HTMLElement>('.landing-reveal').forEach((el) => {
        if (el.classList.contains(LANDING_REVEAL_VISIBLE_CLASS)) return;

        if (el.dataset['revealOnLoad'] !== undefined) {
            if (el.dataset['revealScheduled'] === 'true') return;

            el.dataset['revealScheduled'] = 'true';
            window.setTimeout(() => {
                el.classList.add(LANDING_REVEAL_VISIBLE_CLASS);
            }, REVEAL_ON_LOAD_DELAY_MS);
            return;
        }

        revealObserver.observe(el);
    });

    return revealObserver;
}
