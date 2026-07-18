/* ============================================
   Mohamed Bangura Portfolio - Phase 4: JavaScript Functionality
   Vanilla JavaScript - No Frameworks
   ============================================ */

/* ---------- Mobile Navigation ---------- */
function initMobileNav() {
    const navbar = document.querySelector('.navbar');
    const navMenu = document.querySelector('.nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');
    
    // Create hamburger menu button
    const hamburger = document.createElement('div');
    hamburger.className = 'hamburger';
    hamburger.innerHTML = '<span></span><span></span><span></span>';
    hamburger.setAttribute('aria-label', 'Toggle navigation menu');
    hamburger.setAttribute('role', 'button');
    hamburger.setAttribute('tabindex', '0');
    
    // Insert hamburger before nav-menu in nav-container
    if (navMenu && navbar) {
        const navContainer = document.querySelector('.nav-container');
        if (navContainer) {
            navContainer.appendChild(hamburger);
        }
    }
    
    // Toggle mobile navigation
    function toggleMenu() {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
    }
    
    // Close mobile navigation
    function closeMenu() {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    }
    
    // Event listeners
    hamburger.addEventListener('click', toggleMenu);
    hamburger.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
            toggleMenu();
        }
    });
    
    // Close menu when a nav link is clicked
    navLinks.forEach(link => {
        link.addEventListener('click', closeMenu);
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
        if (!navbar.contains(e.target)) {
            closeMenu();
        }
    });
}

/* ---------- Scroll Animations ---------- */
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.15,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    // Select elements to animate
    const animatedElements = document.querySelectorAll(
        '.section-title, .about-content p, .skill-category, ' +
        '.project-card, .service-card, .contact-info, .contact-form'
    );
    
    // Add initial class and observe each element
    animatedElements.forEach(el => {
        el.classList.add('reveal-element');
        observer.observe(el);
    });
}

/* ---------- Active Navigation Highlighting ---------- */
function initActiveNav() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    
    function highlightNavLink() {
        let currentSectionId = '';
        const scrollPosition = window.scrollY + 100;
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            
            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                currentSectionId = section.getAttribute('id');
            }
        });
        
        navLinks.forEach(link => {
            link.classList.remove('nav-link-active');
            if (link.getAttribute('href') === '#' + currentSectionId) {
                link.classList.add('nav-link-active');
            }
        });
    }
    
    // Throttle scroll events for performance
    let scrollTimeout;
    window.addEventListener('scroll', function() {
        if (scrollTimeout) {
            window.cancelAnimationFrame(scrollTimeout);
        }
        scrollTimeout = window.requestAnimationFrame(highlightNavLink);
    });
}

/* ---------- Dynamic Footer Year ---------- */
function initDynamicYear() {
    const yearElements = document.querySelectorAll('.footer-copyright');
    const currentYear = new Date().getFullYear();
    
    yearElements.forEach(element => {
        element.textContent = element.textContent.replace('2026', currentYear);
    });
}

/* ---------- Contact Form (Web3Forms) ---------- */
function initContactForm() {
    const contactForm = document.getElementById('contact-form');
    const formStatus = document.getElementById('form-status');
    const submitButton = contactForm ? contactForm.querySelector('button[type="submit"]') : null;
    
    if (!contactForm || !formStatus) return;
    
    // Helper function to reset form state
    function resetFormState() {
        contactForm.classList.remove('sending');
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.textContent = 'Send Message';
        }
    }
    
    contactForm.addEventListener('submit', function(e) {
        // Always prevent default form submission (we handle it via fetch)
        e.preventDefault();
        
        // Prevent duplicate submissions
        if (contactForm.classList.contains('sending')) {
            return;
        }
        
        // Show sending status and disable button
        formStatus.textContent = 'Sending...';
        formStatus.className = 'form-status sending';
        contactForm.classList.add('sending');
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent = 'Sending...';
        }
        
        // Web3Forms will handle the actual submission via fetch
        fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            body: new FormData(contactForm),
            headers: {
                'Accept': 'application/json'
            }
        })
        .then(function(response) {
            if (response.ok) {
                formStatus.textContent = 'Message sent successfully! I\'ll get back to you soon.';
                formStatus.className = 'form-status success';
                contactForm.reset();
                
                // Reset form state
                resetFormState();
                
                // Auto-hide success message after 4 seconds
                setTimeout(function() {
                    formStatus.className = 'form-status';
                    formStatus.textContent = '';
                }, 4000);
            } else {
                throw new Error('Form submission failed');
            }
        })
        .catch(function(error) {
            console.error('Web3Forms error:', error);
            formStatus.textContent = 'Something went wrong. Please try again.';
            formStatus.className = 'form-status error';
            
            // Reset form state
            resetFormState();
            
            // Auto-hide error message after 5 seconds
            setTimeout(function() {
                formStatus.className = 'form-status';
                formStatus.textContent = '';
            }, 5000);
        });
    });
}

/* ---------- Initialize All Functionality ---------- */
document.addEventListener('DOMContentLoaded', function() {
    initMobileNav();
    initScrollAnimations();
    initActiveNav();
    initDynamicYear();
    initContactForm();
});
