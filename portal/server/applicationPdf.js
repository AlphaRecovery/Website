import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// Renders a completed employment application payload as a readable, multi-page
// PDF so reviewers get a document they can actually read instead of a raw JSON
// dump. The renderer is generic: it walks the payload, humanizes keys, and lays
// out nested objects/arrays, so new sections/fields appear automatically.

const PAGE = [612, 792];
const MARGIN = 50;
const CONTENT_WIDTH = PAGE[0] - MARGIN * 2;
const RED = rgb(0.69, 0, 0);
const INK = rgb(0.1, 0.12, 0.15);
const MUTED = rgb(0.38, 0.4, 0.45);

// Preferred section order; unknown keys are appended in payload order.
const SECTION_ORDER = [
  'positionInformation', 'personalInformation', 'workAuthorization', 'eligibility',
  'availability', 'militaryService', 'education', 'professionalLicenses', 'licenses',
  'certifications', 'employmentHistory', 'governmentContractEligibility', 'governmentContract',
  'criminalHistory', 'drivingRecord', 'references', 'languages',
  'backgroundAuthorization', 'standardsOfConduct', 'signatures', 'applicantCertification'
];
const SKIP_KEYS = new Set(['account']);

function humanize(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bSsn\b/g, 'SSN');
}

function isEmpty(value) {
  return value === null || value === undefined
    || (typeof value === 'string' && value.trim() === '')
    || (Array.isArray(value) && value.length === 0);
}

function formatScalar(value) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function wrap(text, font, size, maxWidth) {
  const lines = [];
  for (const rawLine of String(text).split('\n')) {
    let line = '';
    for (const word of rawLine.split(/\s+/)) {
      let piece = word;
      // Break words that are too long to fit on their own line.
      while (font.widthOfTextAtSize(piece, size) > maxWidth && piece.length > 1) {
        let cut = piece.length;
        while (cut > 1 && font.widthOfTextAtSize(piece.slice(0, cut), size) > maxWidth) cut -= 1;
        const head = (line ? line + ' ' : '') + piece.slice(0, cut);
        lines.push(head);
        line = '';
        piece = piece.slice(cut);
      }
      const test = line ? `${line} ${piece}` : piece;
      if (line && font.widthOfTextAtSize(test, size) > maxWidth) {
        lines.push(line);
        line = piece;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines.length ? lines : [''];
}

export async function buildApplicationPdf({ payload = {}, role = {}, confirmation = '' } = {}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage(PAGE);
  let y = PAGE[1] - MARGIN;

  const newPage = () => { page = doc.addPage(PAGE); y = PAGE[1] - MARGIN; };

  function draw(text, { font: f = font, size = 10, color = INK, indent = 0, gap = 4 } = {}) {
    const maxWidth = CONTENT_WIDTH - indent;
    for (const line of wrap(text, f, size, maxWidth)) {
      if (y - (size + gap) < MARGIN) newPage();
      page.drawText(line, { x: MARGIN + indent, y: y - size, size, font: f, color });
      y -= size + gap;
    }
  }

  function renderValue(value, indent) {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (isEmpty(item)) return;
        if (item && typeof item === 'object') {
          draw(`#${index + 1}`, { font: bold, size: 10, color: MUTED, indent });
          renderValue(item, indent + 12);
          y -= 2;
        } else {
          draw(`• ${formatScalar(item)}`, { size: 10, indent });
        }
      });
    } else if (value && typeof value === 'object') {
      for (const [key, val] of Object.entries(value)) {
        if (isEmpty(val)) continue;
        if (val && typeof val === 'object') {
          draw(`${humanize(key)}:`, { font: bold, size: 10, indent });
          renderValue(val, indent + 12);
        } else {
          draw(`${humanize(key)}: ${formatScalar(val)}`, { size: 10, indent });
        }
      }
    } else {
      draw(formatScalar(value), { size: 10, indent });
    }
  }

  // Header
  draw('Alpha Recovery Employment Application', { font: bold, size: 18, color: RED, gap: 8 });
  draw(`Position: ${role.title || payload.positionInformation?.roleTitle || 'Not provided'}`, { font: bold, size: 11 });
  if (confirmation) draw(`Reference: ${confirmation}`, { size: 10, color: MUTED });
  draw(`Generated: ${new Date().toISOString().slice(0, 10)}`, { size: 10, color: MUTED, gap: 14 });

  const orderedKeys = [
    ...SECTION_ORDER.filter((key) => key in payload),
    ...Object.keys(payload).filter((key) => !SECTION_ORDER.includes(key) && !SKIP_KEYS.has(key))
  ];

  for (const key of orderedKeys) {
    if (SKIP_KEYS.has(key)) continue;
    const value = payload[key];
    if (isEmpty(value)) continue;
    if (y - 28 < MARGIN) newPage();
    y -= 6;
    draw(humanize(key), { font: bold, size: 13, color: RED, gap: 6 });
    renderValue(value, 0);
    y -= 6;
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
