document.addEventListener('DOMContentLoaded', () => {

    // 1. Custom Cursor Logic REMOVED

    // 2. Scroll Reveal / Observer
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
            }
        });
    }, observerOptions);

    // Header Scroll Effect
    const header = document.querySelector('header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // Select elements to animate
    const revealElements = document.querySelectorAll('.project-item, .section-title, .bio-text p, .skill-tag, .interest-card');

    revealElements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s cubic-bezier(0.25, 1, 0.5, 1), transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
        // Randomize delay slightly for human feel
        const delay = (index % 5) * 0.1;
        el.style.transitionDelay = `${delay}s`;

        observer.observe(el);
    });

    // Add class for the transition to take effect
    // We add a class .in-view which resets opacity and transform
    const style = document.createElement('style');
    style.innerHTML = `
        .in-view {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
    `;
    document.head.appendChild(style);

    // 3. Magnetic Buttons
    const magneticBtns = document.querySelectorAll('.magnetic-btn');

    magneticBtns.forEach(btn => {
        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            // Move button slightly towards cursor
            btn.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px) scale(1.1)`;
        });

        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'translate(0px, 0px) scale(1)';
        });
    });

    // 4. Lightbox Logic
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxCaption = document.getElementById('lightbox-caption');
    const closeBtn = document.getElementsByClassName('lightbox-close')[0];

    if (lightbox) {
        // Open Lightbox
        document.querySelectorAll('.lightbox-trigger, .lightbox-trigger img').forEach(item => {
            item.addEventListener('click', (e) => {
                // If clicked on div wrapper, get the img inside
                let img = e.target.tagName === 'IMG' ? e.target : e.target.querySelector('img');
                if (img) {
                    lightbox.style.display = 'block';
                    lightboxImg.src = img.src;
                    lightboxCaption.innerHTML = img.alt;
                }
            });
        });

        // Close functions
        const closeLightbox = () => {
            lightbox.style.display = "none";
        }

        closeBtn.onclick = closeLightbox;

        // Close on click outside
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) {
                closeLightbox();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === "Escape" && lightbox.style.display === "block") {
                closeLightbox();
            }
        });
    }

});
