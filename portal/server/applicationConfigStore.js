import { APPLICATION_TOTAL_SECTIONS, ROLE_CONFIGS, SECTION_TITLES, UPLOAD_LABELS } from '../shared/applicationConfig.js';
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
    uploadLabels: normalizeUploadLabels(),
    roles: normalizeRoles(),
    updated_at: null,
    updated_by: null
  };
}

export function liveApplicationConfig(database = getDb()) {
  const stored = (database.application_configs || []).find((row) => row.id === LIVE_CONFIG_ID) || {};
  return {
    ...defaultLiveApplicationConfig(),
    ...stored,
    sectionTitles: normalizeSections(stored.sectionTitles),
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
  const next = {
    ...liveApplicationConfig(db),
    ...patch,
    id: LIVE_CONFIG_ID,
    sectionTitles: normalizeSections(patch.sectionTitles),
    uploadLabels: normalizeUploadLabels(patch.uploadLabels),
    roles: normalizeRoles(patch.roles),
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
