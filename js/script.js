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

    // 5. Project Filtering & Load More Logic
    const filterBtns = document.querySelectorAll('.filter-btn');
    const projectItems = document.querySelectorAll('.project-item');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const ITEMS_TO_SHOW = 3;
    let isExpanded = false;

    // Helper: Update visibility based on categories and expansion
    const updateProjectsVisibility = (filterValue) => {
        let visibleCount = 0;

        projectItems.forEach((item, index) => {
            const category = item.getAttribute('data-category');
            const matches = filterValue === 'all' || filterValue === category;

            if (matches) {
                // Determine if item should be shown
                // Show if:
                // 1. Filter is NOT 'all' (User wants to see specific category -> show all matches)
                // 2. We are expanded (User clicked 'Load More')
                // 3. We are within the limit (first 3 items)
                if (filterValue !== 'all' || isExpanded || visibleCount < ITEMS_TO_SHOW) {
                    item.style.display = 'block';
                    setTimeout(() => {
                        item.style.opacity = '1';
                        item.style.transform = 'translateY(0)';
                    }, 50);
                } else {
                    item.style.display = 'none';
                }
                visibleCount++;
            } else {
                item.style.display = 'none';
            }
        });

        // Toggle Load More Button
        // Show only if: Filter is 'all', NOT expanded, and there are more items to show
        if (filterValue === 'all' && !isExpanded && visibleCount > ITEMS_TO_SHOW) {
            if (loadMoreBtn) loadMoreBtn.style.display = 'inline-block';
        } else {
            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
        }
    };

    // Initialize with default view (first 3)
    updateProjectsVisibility('all');

    // Load More Click Handler
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            isExpanded = true;
            updateProjectsVisibility('all');
        });
    }

    // Filter Click Handlers
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            filterBtns.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');

            const filterValue = btn.getAttribute('data-filter');

            // Reset expansion when filtering? 
            // User requirement: "Si on utilise les filtres... affiche tous les résultats".
            // So we don't need to reset isExpanded, but the logic handles showing all anyway.
            // If we go back to 'all', do we stay expanded? 
            // Let's reset isExpanded to false when clicking 'all' to re-enable the button?
            // Or keep it expanded if user already clicked it?
            // Decision: If user clicks 'All' again, let's reset to limited view to give them control back.
            if (filterValue === 'all') {
                isExpanded = false;
            }

            updateProjectsVisibility(filterValue);
        });
    });

    // 6. Mobile Menu Logic
    const menuBtn = document.querySelector('.menu-btn');
    const mobileNavOverlay = document.querySelector('.mobile-nav-overlay');
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-links a');

    if (menuBtn && mobileNavOverlay) {
        menuBtn.addEventListener('click', () => {
            mobileNavOverlay.classList.toggle('active');

            // Optional: Change text from MENU to CLOSE
            if (mobileNavOverlay.classList.contains('active')) {
                menuBtn.textContent = 'CLOSE';
                menuBtn.style.color = 'var(--text-primary)';
            } else {
                menuBtn.textContent = 'MENU';
                menuBtn.style.color = 'inherit';
            }
        });

        // Close menu when link is clicked
        mobileNavLinks.forEach(link => {
            link.addEventListener('click', () => {
                mobileNavOverlay.classList.remove('active');
                menuBtn.textContent = 'MENU';
            });
        });
    }

});
