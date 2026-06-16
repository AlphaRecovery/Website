function getContentValue(content, path) {
  return path.split('.').reduce((value, key) => value && value[key], content);
}

function setSharedContent(content) {
  if (content.design) {
    const root = document.documentElement;
    if (content.design.primaryRed) root.style.setProperty('--bright-red', content.design.primaryRed);
    if (content.design.text) root.style.setProperty('--bright-white', content.design.text);
    if (content.design.background) root.style.setProperty('--black', content.design.background);
  }
  const customCss = document.getElementById('custom-site-css');
  if (customCss && content.seo) customCss.textContent = content.seo.customCss || '';
  document.querySelectorAll('[data-content]').forEach((element) => {
    const value = getContentValue(content, element.dataset.content);
    if (typeof value === 'string') element.textContent = value;
  });
}

function openJobs(content) {
  return (content.opportunities?.jobs || []).filter((job) => job.status === 'open');
}

function jobSlug(job) {
  return job.slug || job.id;
}

function jobApplyUrl(job) {
  const path = job.applyUrl || `/apply/${encodeURIComponent(jobSlug(job))}`;
  if (/^https?:\/\//.test(path) || !path.startsWith('/apply/')) return path;
  const localHosts = ['localhost', '127.0.0.1', '::1'];
  if (localHosts.includes(window.location.hostname)) return path;
  return `https://portal.alpharecovery.org${path}`;
}

function renderJobCard(job) {
  return `
    <a class="job-card" href="job.html?id=${encodeURIComponent(jobSlug(job))}">
      <div>
        <h3>${job.title}</h3>
        <p>${job.summary}</p>
        <div class="meta" style="margin-top:0.9rem;">
          <span>${job.service || 'Child Welfare'}</span>
          <span>${job.department}</span>
          <span>${job.location}</span>
          <span>${job.employmentType}</span>
        </div>
      </div>
      <div>
        <p style="color:var(--bright-red);letter-spacing:0.18em;text-transform:uppercase;font-size:0.55rem;">View Position</p>
      </div>
    </a>
  `;
}

function populateSelect(select, values, label) {
  const selected = select.value;
  select.innerHTML = `<option value="">${label}</option>` + [...new Set(values.filter(Boolean))].sort().map((value) => `<option value="${value}">${value}</option>`).join('');
  select.value = selected;
}

function initCareersLanding(content) {
  setSharedContent(content);
  const jobs = openJobs(content);
  const serviceOptions = [
    'Child Welfare',
    'Security',
    'Intelligence',
    'Fugitive Recovery',
    'Crisis Management',
    'Law Enforcement Support'
  ];
  const grid = document.getElementById('jobsGrid');
  const count = document.getElementById('jobCount');
  const keyword = document.getElementById('keywordFilter');
  const serviceFilter = document.getElementById('serviceFilter');
  const departmentFilter = document.getElementById('departmentFilter');
  const employmentFilter = document.getElementById('employmentFilter');
  const locationFilter = document.getElementById('locationFilter');
  const clearanceFilter = document.getElementById('clearanceFilter');
  const applyFilters = document.getElementById('applyFilters');
  const clearFilters = document.getElementById('clearFilters');
  if (!grid) return;

  populateSelect(serviceFilter, serviceOptions, 'Service');
  populateSelect(departmentFilter, jobs.map((job) => job.department), 'Department');
  populateSelect(employmentFilter, jobs.map((job) => job.employmentType), 'Employment Type');
  populateSelect(locationFilter, jobs.map((job) => job.location), 'Location');
  populateSelect(clearanceFilter, jobs.map((job) => job.clearanceRequirement), 'Clearance Requirement');

  function render() {
    const keywordValue = keyword.value.trim().toLowerCase();
    const visible = jobs.filter((job) => {
      const jobService = job.service || 'Child Welfare';
      const haystack = `${job.title} ${job.summary} ${jobService} ${job.department} ${job.location} ${job.employmentType} ${job.clearanceRequirement}`.toLowerCase();
      return (!keywordValue || haystack.includes(keywordValue))
        && (!serviceFilter.value || jobService === serviceFilter.value)
        && (!departmentFilter.value || job.department === departmentFilter.value)
        && (!employmentFilter.value || job.employmentType === employmentFilter.value)
        && (!locationFilter.value || job.location === locationFilter.value)
        && (!clearanceFilter.value || job.clearanceRequirement === clearanceFilter.value);
    });
    count.textContent = `${visible.length} open ${visible.length === 1 ? 'position' : 'positions'}`;
    grid.innerHTML = visible.length ? visible.map(renderJobCard).join('') : '<div class="empty-state">No positions match those filters.</div>';
  }

  [keyword, serviceFilter, departmentFilter, employmentFilter, locationFilter, clearanceFilter].forEach((control) => {
    control.addEventListener('input', render);
    control.addEventListener('change', render);
  });
  if (applyFilters) applyFilters.addEventListener('click', render);
  if (clearFilters) clearFilters.addEventListener('click', () => {
    [keyword, serviceFilter, departmentFilter, employmentFilter, locationFilter, clearanceFilter].forEach((control) => {
      control.value = '';
    });
    render();
  });
  render();
}

function initJobDetail(content) {
  setSharedContent(content);
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const jobs = openJobs(content);
  // Only fall back to the first job when no id was requested at all; a stale or
  // mistyped id must show "no longer available" instead of the wrong position.
  const job = id ? jobs.find((item) => jobSlug(item) === id || item.id === id) : jobs[0];
  const root = document.getElementById('jobDetailRoot');
  if (!root) return;
  if (!job) {
    root.innerHTML = '<section class="content-section"><div class="empty-state">This position is no longer available.</div></section>';
    return;
  }
  document.title = `${job.title} | Alpha Recovery Careers`;
  const applyUrl = jobApplyUrl(job);
  root.innerHTML = `
    <section class="job-detail-hero">
      <div class="content-wrap">
        <div class="section-tag">Position Detail</div>
        <h1>${job.title}</h1>
        <p class="lead">${job.location} / ${job.department} / ${job.employmentType}</p>
        <div class="hero-actions"><a class="btn-red" href="${applyUrl}">Apply Now</a></div>
      </div>
    </section>
    <section class="job-detail-grid">
      <article class="job-main">
        <div class="job-section"><h2>About Alpha Recovery</h2><p>${content.opportunities.aboutAlpha}</p></div>
        <div class="job-section"><h2>Position Summary</h2><p>${job.positionSummary || job.summary}</p></div>
        <div class="job-section"><h2>Key Responsibilities</h2><ul>${(job.responsibilities || []).map((item) => `<li>${item}</li>`).join('')}</ul></div>
        <div class="job-section"><h2>Required Qualifications</h2><ul>${(job.requiredQualifications || job.requirements || []).map((item) => `<li>${item}</li>`).join('')}</ul></div>
        <div class="job-section"><h2>Preferred Qualifications</h2><ul>${(job.preferredQualifications || []).map((item) => `<li>${item}</li>`).join('')}</ul></div>
        <div class="job-section"><h2>Work Environment</h2><ul>${(job.workEnvironment || []).map((item) => `<li>${item}</li>`).join('')}</ul></div>
        <div class="job-section"><h2>Background Investigation Notice</h2><p>${content.opportunities.backgroundNotice}</p></div>
        <div class="job-section"><h2>Equal Opportunity Statement</h2><p>${content.opportunities.eeoStatement}</p></div>
        <div class="final-cta"><h2>Ready to Apply?</h2><p>Start your Alpha Recovery applicant profile and submit your application for this position.</p><a class="btn-red" href="${applyUrl}">Apply Now</a></div>
      </article>
      <aside class="job-sidebar">
        <a class="btn-red" href="${applyUrl}">Apply Now</a>
        <dl>
          <div><dt>Location</dt><dd>${job.location}</dd></div>
          <div><dt>Department</dt><dd>${job.department}</dd></div>
          <div><dt>Employment Type</dt><dd>${job.employmentType}</dd></div>
          <div><dt>Pay Range</dt><dd>${job.payRange}</dd></div>
          <div><dt>Travel</dt><dd>${job.travelRequirement}</dd></div>
          <div><dt>Background</dt><dd>${job.backgroundRequirement}</dd></div>
          <div><dt>Clearance</dt><dd>${job.clearanceRequirement}</dd></div>
        </dl>
      </aside>
    </section>
  `;
}

function initWhyJoin(content) {
  setSharedContent(content);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const targets = document.querySelectorAll('.reveal, .reveal-stagger');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('in'));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });
  targets.forEach((el) => observer.observe(el));
}

function setupMobileNavigation() {
  const toggle = document.querySelector('.mobile-nav-toggle');
  const drawer = document.getElementById('mobile-drawer');
  const backdrop = document.querySelector('.mobile-backdrop');
  if (!toggle || !drawer || !backdrop || toggle.dataset.bound === 'true') return;
  toggle.dataset.bound = 'true';

  function setOpen(open, returnFocus = true) {
    document.body.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (open) {
      const firstLink = drawer.querySelector('a');
      if (firstLink) firstLink.focus({ preventScroll: true });
    } else if (returnFocus) {
      toggle.focus({ preventScroll: true });
    }
  }

  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });
  backdrop.addEventListener('click', () => setOpen(false));
  drawer.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setOpen(false, false));
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') setOpen(false);
  });
  window.addEventListener('resize', () => {
    if (window.innerWidth > 900 && toggle.getAttribute('aria-expanded') === 'true') setOpen(false, false);
  });
}

setupMobileNavigation();

window.AlphaCareers = { initCareersLanding, initJobDetail, initWhyJoin };
