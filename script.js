(function () {
  const navToggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector(".nav-links");
  const form = document.getElementById("contact-form");
  const toast = document.getElementById("toast");

  // Mobile nav
  navToggle?.addEventListener("click", () => {
    const expanded = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!expanded));
    navLinks?.classList.toggle("open");
  });

  navLinks?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navToggle?.setAttribute("aria-expanded", "false");
      navLinks?.classList.remove("open");
    });
  });

  // Banner parallax on cursor
  const bannerStage = document.querySelector(".hero-banner-stage");
  const bannerTrack = document.querySelector(".hero-banner-track");
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if (bannerStage && bannerTrack && !prefersReducedMotion) {
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    const maxShift = 14;

    function setTarget(clientX, clientY) {
      const rect = bannerStage.getBoundingClientRect();
      targetX = ((clientX - rect.left) / rect.width - 0.5) * maxShift;
      targetY = ((clientY - rect.top) / rect.height - 0.5) * maxShift;
    }

    function animateBanner() {
      currentX += (targetX - currentX) * 0.1;
      currentY += (targetY - currentY) * 0.1;
      bannerTrack.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
      requestAnimationFrame(animateBanner);
    }

    bannerStage.addEventListener("mousemove", (e) => setTarget(e.clientX, e.clientY));
    bannerStage.addEventListener("touchmove", (e) => {
      if (e.touches[0]) setTarget(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    bannerStage.addEventListener("mouseleave", () => {
      targetX = 0;
      targetY = 0;
    });
    bannerStage.addEventListener("touchend", () => {
      targetX = 0;
      targetY = 0;
    });

    requestAnimationFrame(animateBanner);
  }

  // Header shadow on scroll
  const header = document.querySelector(".site-header");
  window.addEventListener("scroll", () => {
    if (!header) return;
    header.style.borderBottomColor =
      window.scrollY > 20 ? "rgba(255,255,255,0.12)" : "";
  });

  // Form validation & submit
  const validators = {
    firstName: (v) => v.trim().length >= 2 || "Please enter your first name",
    lastName: (v) => v.trim().length >= 2 || "Please enter your last name",
    email: (v) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || "Please enter a valid email",
    experience: (v) => v !== "" || "Please select your experience level",
    interest: (v) => v !== "" || "Please select a program",
    message: (v) =>
      v.trim().length >= 10 || "Please share a bit more (10+ characters)",
  };

  // HubSpot Forms API — sends submissions into the free CRM as contacts.
  // Portal ID and Form GUID come from the live "New blank form" built in
  // HubSpot, which already has these fields connected to CRM properties;
  // this script posts directly to the API rather than using the form's
  // own hosted/embedded UI, so the custom design here is preserved.
  // NOTE: this portal is hosted on HubSpot's EU data center (eu1), so the
  // submission endpoint must use the api-eu1 host, not the global one.
  const HUBSPOT_PORTAL_ID = "148735175";
  const HUBSPOT_FORM_ID = "91254779-ec88-4531-bc3c-3d8faa884143";
  const HUBSPOT_ENDPOINT = `https://api-eu1.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_FORM_ID}`;

  // Maps this form's field names to HubSpot's internal property names
  const hubspotFieldMap = {
    firstName: "firstname",
    lastName: "lastname",
    email: "email",
    experience: "trading_experience",
    interest: "interested_in",
    message: "which_roadblocks_are_you_facing_in_your_trading_journey",
  };

  function showError(field, message) {
    const group = field.closest(".form-group");
    const errorEl = group?.querySelector(".form-error");
    field.classList.toggle("error", !!message);
    if (errorEl) errorEl.textContent = message || "";
  }

  function validateField(field) {
    const name = field.name;
    const validator = validators[name];
    if (!validator) return true;
    const result = validator(field.value);
    if (result === true) {
      showError(field, "");
      return true;
    }
    showError(field, result);
    return false;
  }

  form?.querySelectorAll("input, select, textarea").forEach((field) => {
    field.addEventListener("blur", () => validateField(field));
    field.addEventListener("input", () => {
      if (field.classList.contains("error")) validateField(field);
    });
  });

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 4000);
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fields = form.querySelectorAll("input, select, textarea");
    let valid = true;
    fields.forEach((field) => {
      if (!validateField(field)) valid = false;
    });
    if (!valid) return;

    const data = Object.fromEntries(new FormData(form));

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalLabel = submitBtn ? submitBtn.textContent : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting…";
    }

    const hubspotFields = Object.entries(data)
      .filter(([key]) => hubspotFieldMap[key])
      .map(([key, value]) => ({
        objectTypeId: "0-1", // Contacts
        name: hubspotFieldMap[key],
        value,
      }));

    // Grab the HubSpot tracking cookie (hutk) if present, so the submission
    // is associated with this visitor. Missing this is the most common
    // cause of partial/odd behavior with the Forms API.
    function getHubspotUtk() {
      const match = document.cookie.match(/(?:^|;\s*)hubspotutk=([^;]+)/);
      return match ? match[1] : undefined;
    }

    const hutk = getHubspotUtk();

    try {
      const response = await fetch(HUBSPOT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: hubspotFields,
          context: {
            pageUri: window.location.href,
            pageName: document.title,
            ...(hutk ? { hutk } : {}),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HubSpot responded with status ${response.status}`);
      }

      showToast("Application sent! We'll be in touch within 24 hours.");
      form.reset();
      fields.forEach((field) => showError(field, ""));
    } catch (err) {
      console.error("Application submission failed:", err);
      showToast(
        "Something went wrong sending your application. Please try again or reach us on Discord/Telegram."
      );
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      }
    }
  });

  // Subtle fade-in on scroll
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = "1";
          entry.target.style.transform = "translateY(0)";
        }
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
  );

  document
    .querySelectorAll(
      ".concept-card, .timeline-item, .tier-card, .testimonial, .contact-form"
    )
    .forEach((el) => {
      el.style.opacity = "0";
      el.style.transform = "translateY(24px)";
      el.style.transition = "opacity 0.6s ease, transform 0.6s ease";
      observer.observe(el);
    });
})();
