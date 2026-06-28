import { APPLICATION_SECTION_CONFIGS, APPLICATION_TOTAL_SECTIONS, ROLE_CONFIGS, SECTION_TITLES, UPLOAD_LABELS } from '../shared/applicationConfig.js';
import { getDb, now, saveDb } from './data/store.js';

const LIVE_CONFIG_ID = 'live';
const ALLOWED_UPLOAD_STATUSES = new Set(['required', 'conditional', 'optional']);

function normalizeUploadLabels(labels = {}) {
  return { ...UPLOAD_LABELS, ...(labels || {}) };
}

function normalizeSections(sectionTitles = SECTION_TITLES) {
  const titles = Array.isArray(sectionTitles) ? sectionTitles : [];
  return Array.from({ length: APPLICATION_TOTAL_SECTIONS }, (_, index) => {
    const title = String(titles[index] || SECTION_TITLES[index] || `Section ${index + 1}`).trim();
    return title || SECTION_TITLES[index] || `Section ${index + 1}`;
  });
}

function normalizeField(field = {}, fallback = {}) {
  return {
    key: String(field.key || fallback.key || '').trim(),
    originalLabel: String(fallback.originalLabel || fallback.label || field.originalLabel || field.label || field.key || fallback.key || '').trim(),
    label: String(field.label || fallback.label || field.key || fallback.key || '').trim(),
    type: String(field.type || fallback.type || 'text').trim(),
    options: Array.isArray(field.options) ? field.options.filter(Boolean).map(String) : (fallback.options || []),
    required: Boolean(field.required ?? fallback.required),
    help: String(field.help || fallback.help || '').trim()
  };
}

function normalizeApplicationSections(sections = APPLICATION_SECTION_CONFIGS, sectionTitles = SECTION_TITLES) {
  const rows = Array.isArray(sections) ? sections : [];
  return APPLICATION_SECTION_CONFIGS.map((fallback, index) => {
    const match = rows[index] || rows.find((section) => section?.id === fallback.id) || {};
    const fallbackFields = fallback.fields || [];
    const incomingFields = Array.isArray(match.fields) ? match.fields : [];
    const fieldByKey = Object.fromEntries(incomingFields.map((field) => [field?.key, field]).filter(([key]) => key));
    const fallbackKeys = new Set(fallbackFields.map((field) => field.key));
    const customFields = incomingFields
      .filter((field) => field?.key && !fallbackKeys.has(field.key))
      .map((field) => normalizeField(field))
      .filter((field) => field.key && field.label);
    return {
      id: String(match.id || fallback.id || `section-${index + 1}`).trim(),
      title: String(match.title || sectionTitles[index] || fallback.title || `Section ${index + 1}`).trim(),
      intro: String(match.intro || fallback.intro || '').trim(),
      body: String(match.body || fallback.body || '').trim(),
      fields: [
        ...fallbackFields.map((field) => normalizeField(fieldByKey[field.key], field)),
        ...customFields
      ]
    };
  });
}

function normalizeRole(role = {}, fallback = {}) {
  const base = { ...fallback, ...role };
  const uploads = Object.entries({ ...(fallback.uploads || {}), ...(base.uploads || {}) })
    .reduce((acc, [field, status]) => {
      if (Object.prototype.hasOwnProperty.call(UPLOAD_LABELS, field) && ALLOWED_UPLOAD_STATUSES.has(status)) acc[field] = status;
      return acc;
    }, {});
  return {
    slug: String(base.slug || fallback.slug || base.title || '').trim(),
    title: String(base.title || fallback.title || '').trim(),
    department: String(base.department || fallback.department || '').trim(),
    location: String(base.location || fallback.location || '').trim(),
    employmentType: String(base.employmentType || fallback.employmentType || '').trim(),
    travel: Array.isArray(base.travel) ? base.travel.filter(Boolean) : (fallback.travel || []),
    drivingRequired: Boolean(base.drivingRequired),
    languageRole: base.languageRole || fallback.languageRole || 'none',
    certs: Array.isArray(base.certs) ? base.certs.filter(Boolean) : (fallback.certs || []),
    uploads,
    requiredEducation: Array.isArray(base.requiredEducation) ? base.requiredEducation.filter(Boolean) : (fallback.requiredEducation || []),
    minimumRelevantExperienceYears: Number(base.minimumRelevantExperienceYears ?? fallback.minimumRelevantExperienceYears ?? 0)
  };
}

function normalizeRoles(roles = ROLE_CONFIGS) {
  const fallbackBySlug = Object.fromEntries(ROLE_CONFIGS.map((role) => [role.slug, role]));
  const rows = Array.isArray(roles) && roles.length ? roles : ROLE_CONFIGS;
  const normalized = rows
    .map((role) => normalizeRole(role, fallbackBySlug[role?.slug] || {}))
    .filter((role) => role.slug && role.title);
  return normalized.length ? normalized : ROLE_CONFIGS.map((role) => normalizeRole(role, role));
}

export function defaultLiveApplicationConfig() {
  return {
    id: LIVE_CONFIG_ID,
    name: 'Live Employment Application',
    status: 'active',
    sectionTitles: normalizeSections(),
    sections: normalizeApplicationSections(),
    uploadLabels: normalizeUploadLabels(),
    roles: normalizeRoles(),
    updated_at: null,
    updated_by: null
  };
}

export function liveApplicationConfig(database = getDb()) {
  const stored = (database.application_configs || []).find((row) => row.id === LIVE_CONFIG_ID) || {};
  const sections = normalizeApplicationSections(stored.sections, stored.sectionTitles);
  return {
    ...defaultLiveApplicationConfig(),
    ...stored,
    sections,
    sectionTitles: sections.map((section) => section.title),
    uploadLabels: normalizeUploadLabels(stored.uploadLabels),
    roles: normalizeRoles(stored.roles)
  };
}

export function liveApplicationRoles(database = getDb()) {
  return liveApplicationConfig(database).roles;
}

export function liveRoleBySlug(slug, database = getDb()) {
  return liveApplicationRoles(database).find((role) => role.slug === slug);
}

export function liveUploadLabels(database = getDb()) {
  return liveApplicationConfig(database).uploadLabels;
}

export function liveSectionTitles(database = getDb()) {
  return liveApplicationConfig(database).sectionTitles;
}

export function saveLiveApplicationConfig(patch = {}, actorId = null) {
  const db = getDb();
  const current = liveApplicationConfig(db);
  const merged = {
    ...current,
    ...patch
  };
  const sections = normalizeApplicationSections(merged.sections, merged.sectionTitles);
  const next = {
    ...merged,
    id: LIVE_CONFIG_ID,
    sections,
    sectionTitles: sections.map((section) => section.title),
    uploadLabels: normalizeUploadLabels(merged.uploadLabels),
    roles: normalizeRoles(merged.roles),
    updated_at: now(),
    updated_by: actorId
  };
  const index = (db.application_configs || []).findIndex((row) => row.id === LIVE_CONFIG_ID);
  if (index >= 0) db.application_configs[index] = next;
  else db.application_configs.push(next);
  saveDb();
  return next;
}

export function resetLiveApplicationConfig(actorId = null) {
  const db = getDb();
  const next = { ...defaultLiveApplicationConfig(), updated_at: now(), updated_by: actorId };
  db.application_configs = (db.application_configs || []).filter((row) => row.id !== LIVE_CONFIG_ID);
  db.application_configs.push(next);
  saveDb();
  return next;
}
