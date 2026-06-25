import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { UPLOAD_LABELS } from '../shared/applicationConfig.js';

const PAGE_SIZE = [612, 792];
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_SIZE[0] - MARGIN * 2;
const COLORS = {
  ink: rgb(0.08, 0.1, 0.13),
  muted: rgb(0.38, 0.42, 0.48),
  line: rgb(0.78, 0.81, 0.85),
  soft: rgb(0.95, 0.96, 0.97),
  brand: rgb(0.05, 0.18, 0.32)
};

function value(input) {
  if (input === null || input === undefined) return '';
  if (Array.isArray(input)) return input.filter(Boolean).join(', ');
  return String(input);
}

function yesNo(input) {
  const clean = value(input).trim().toLowerCase();
  if (clean === 'yes' || clean === 'true') return 'Yes';
  if (clean === 'no' || clean === 'false') return 'No';
  return value(input);
}

function compact(input) {
  return value(input).replace(/\s+/g, ' ').trim();
}

function labelFromKey(key) {
  return String(key || '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function lineFits(font, text, size, width) {
  return font.widthOfTextAtSize(text, size) <= width;
}

function wrapText(text, font, size, width) {
  const words = compact(text).split(/\s+/).filter(Boolean);
  if (!words.length) return ['Not provided'];
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (!line || lineFits(font, next, size, width)) {
      line = next;
      continue;
    }
    lines.push(line);
    if (lineFits(font, word, size, width)) {
      line = word;
      continue;
    }
    let chunk = '';
    for (const char of word) {
      const nextChunk = `${chunk}${char}`;
      if (!chunk || lineFits(font, nextChunk, size, width)) {
        chunk = nextChunk;
      } else {
        lines.push(chunk);
        chunk = char;
      }
    }
    line = chunk;
  }
  if (line) lines.push(line);
  return lines;
}

function rowValue(row, keys) {
  return keys.map((key) => value(row?.[key])).find(Boolean) || '';
}

function rowSummary(row, columns = []) {
  return columns
    .map((keys) => {
      const label = Array.isArray(keys) ? keys[0] : keys;
      const inputKeys = Array.isArray(keys) ? keys.slice(1) : [keys];
      const text = rowValue(row, inputKeys.length ? inputKeys : [label]);
      return text ? `${labelFromKey(label)}: ${text}` : '';
    })
    .filter(Boolean)
    .join('; ') || value(row);
}

function certificationRows(payload = {}) {
  const records = payload.certifications?.records || [];
  const selected = payload.certifications?.selected || [];
  if (records.length) return records;
  return selected.map((name) => ({ name }));
}

function uploadedRows(payload = {}, uploads = {}) {
  const payloadFields = Object.entries(payload.uploads || {})
    .filter(([, item]) => Array.isArray(item) ? item.length > 0 : !!item)
    .map(([field]) => ({ field, fileNames: ['Recorded in application'] }));
  const fileFields = Object.entries(uploads || {})
    .filter(([, items]) => Array.isArray(items) && items.length > 0)
    .map(([field, items]) => ({ field, fileNames: items.map((item) => item.originalname || item.name || 'Uploaded file') }));
  const byField = new Map();
  for (const row of [...payloadFields, ...fileFields]) {
    const current = byField.get(row.field) || [];
    byField.set(row.field, [...current, ...row.fileNames]);
  }
  return [...byField.entries()].map(([field, fileNames]) => ({
    field: UPLOAD_LABELS[field] || labelFromKey(field),
    fileNames: [...new Set(fileNames)].join(', ')
  }));
}

function buildSections(payload = {}, role = {}, confirmation = '', uploads = {}) {
  const position = payload.positionInformation || {};
  const personal = payload.personalInformation || {};
  const work = payload.workAuthorization || {};
  const availability = payload.availability || {};
  const military = payload.militaryService || {};
  const education = payload.education || {};
  const employment = payload.employmentHistory || {};
  const government = payload.governmentEligibility || payload.governmentContractEligibility || {};
  const criminal = payload.criminalHistory || {};
  const driving = payload.drivingRecord || {};
  const background = payload.backgroundAuthorization || {};
  const signatures = payload.signatures || {};
  const applicantCertification = payload.applicantCertification || {};

  return [
    {
      title: 'Position Information',
      fields: [
        ['Role Title', role.title || position.roleTitle],
        ['Department', role.department || position.department],
        ['Location', role.location || position.location],
        ['Employment Type', role.employmentType || position.employmentType],
        ['Desired Start Date', position.desiredStartDate],
        ['Desired Pay', position.desiredPay],
        ['Heard About Us', position.heardAboutUs],
        ['Confirmation Number', confirmation]
      ]
    },
    {
      title: 'Personal Information',
      fields: [
        ['Full Name', personal.fullName],
        ['Email', personal.email],
        ['Phone', personal.phone],
        ['SSN Last 4', personal.ssnLast4],
        ['Address', [personal.address, personal.city, personal.state, personal.zip].filter(Boolean).join(', ')]
      ]
    },
    {
      title: 'Work Authorization',
      fields: [
        ['Authorized To Work', yesNo(work.authorized)],
        ['Requires Sponsorship', yesNo(work.sponsorship)],
        ['Age 18 Or Older', yesNo(work.age18)],
        ['Proof Notes', work.proof]
      ]
    },
    {
      title: 'Availability',
      fields: [
        ['Travel Availability', availability.travelAvailability],
        ['Reliable Transportation', availability.reliableTransportation],
        ["Valid Driver's License", availability.validDriversLicense],
        ['Vehicle Insurance', availability.vehicleInsurance],
        ['Schedule Notes', availability.scheduleNotes]
      ]
    },
    {
      title: 'Military Service',
      fields: [
        ['Served', yesNo(military.served)],
        ['Branch', military.branch],
        ['Other Branch', military.branchOther],
        ['Discharge Type', military.dischargeType],
        ['Disabled Veteran', military.disabledVeteran],
        ['Discharge Notes', military.dischargeOther]
      ]
    },
    {
      title: 'Education',
      fields: [
        ['Highest Level', education.highestLevel],
        ['Experience Alternative', education.useExperienceAlternative ? 'Applicant requested to use 10+ years of relevant experience as an alternative to the education requirement. A separate experience narrative upload is required.' : 'No']
      ],
      rows: [
        {
          label: 'Education Records',
          items: education.degrees || [],
          columns: ['school', 'degree', 'field', ['graduation', 'graduationYear', 'graduationDate']]
        }
      ]
    },
    {
      title: 'Certifications And Languages',
      rows: [
        {
          label: 'Certifications',
          items: certificationRows(payload),
          columns: ['group', ['name', 'certification'], ['license', 'licenseNumber', 'number'], 'state', ['expiration', 'expirationDate', 'status']]
        },
        {
          label: 'Languages',
          items: payload.languages || [],
          columns: ['language', 'proficiency', 'skills', 'certification']
        }
      ]
    },
    {
      title: 'Employment History',
      fields: [
        ['Years Relevant Experience', employment.yearsRelevantExperience],
        ['Employment Summary', employment.summary]
      ],
      rows: [
        {
          label: 'Employers',
          items: employment.employers || [],
          columns: ['employer', 'title', 'startDate', 'endDate', 'supervisor', 'phone', 'reasonForLeaving', 'duties']
        }
      ]
    },
    {
      title: 'Government Eligibility',
      fields: [
        ['Prior Government Contract Work', yesNo(government.priorGovernmentContractWork)],
        ['Agency', government.agency],
        ['Clearance Held', government.clearanceHeld],
        ['Debarred', government.debarred],
        ['Notes', government.notes]
      ]
    },
    {
      title: 'Criminal History',
      fields: [
        ['Felony Conviction', yesNo(criminal.felonyConviction)],
        ['Misdemeanor Conviction', yesNo(criminal.misdemeanorConviction)],
        ['Pending Charges', yesNo(criminal.pendingCharges)],
        ['Deferred Adjudication', yesNo(criminal.deferredAdjudication)],
        ['Military Court Martial', yesNo(criminal.militaryCourtMartial)],
        ['Registry Required', yesNo(criminal.registryRequired)],
        ['Acknowledgment', criminal.acknowledgment ? 'Yes' : 'No']
      ],
      rows: [
        {
          label: 'Offenses',
          items: criminal.offenses || [],
          columns: ['type', 'offense', 'offenseDate', 'jurisdiction', 'court', 'disposition', 'sentence', 'status', 'context']
        }
      ]
    },
    {
      title: 'Driving Record',
      fields: [
        ['Valid License', yesNo(driving.validLicense)],
        ["Driver's License Number", driving.licenseNumber],
        ['State', driving.state],
        ['CDL', driving.cdl],
        ['Moving Violations', driving.movingViolations],
        ['Accidents', driving.accidents],
        ['DUI History', driving.duiHistory]
      ]
    },
    {
      title: 'References',
      rows: [
        {
          label: 'Professional References',
          items: payload.references || [],
          columns: ['name', 'relationship', 'company', 'phone', 'email', 'yearsKnown']
        }
      ]
    },
    {
      title: 'Background Authorization',
      fields: [
        ['Full Legal Name', background.fullLegalName],
        ['Date Of Birth', background.dateOfBirth],
        ['Social Security Number', background.socialSecurityNumber],
        ['Current Address', background.currentAddress],
        ['Position Applied For', role.title || background.positionAppliedFor],
        ['Typed Signature', background.typedSignature || signatures.backgroundAuthorization],
        ['Signature Date', background.signatureDate],
        ['Printed Name', background.printedName]
      ]
    },
    {
      title: 'Standards And Applicant Certification',
      fields: [
        ['Standards Of Conduct Signature', signatures.standardsOfConduct || payload.standardsOfConduct?.typedFullLegalName],
        ['Applicant Certification Signature', applicantCertification.typedFullLegalName || signatures.applicantCertification],
        ['Applicant Certification Date', applicantCertification.date],
        ['Reference Number', confirmation]
      ]
    },
    {
      title: 'Uploaded Documents',
      rows: [
        {
          label: 'Files',
          items: uploadedRows(payload, uploads),
          columns: ['field', 'fileNames']
        }
      ]
    }
  ];
}

class PdfReport {
  constructor(doc, fonts) {
    this.doc = doc;
    this.font = fonts.regular;
    this.bold = fonts.bold;
    this.page = null;
    this.y = 0;
    this.pageNumber = 0;
    this.addPage();
  }

  addPage() {
    this.page = this.doc.addPage(PAGE_SIZE);
    this.pageNumber += 1;
    this.y = PAGE_SIZE[1] - MARGIN;
    this.page.drawText('Alpha Recovery Employment Application', {
      x: MARGIN,
      y: this.y,
      size: 9,
      font: this.bold,
      color: COLORS.brand
    });
    this.page.drawText(`Page ${this.pageNumber}`, {
      x: PAGE_SIZE[0] - MARGIN - 44,
      y: this.y,
      size: 8,
      font: this.font,
      color: COLORS.muted
    });
    this.y -= 18;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_SIZE[0] - MARGIN, y: this.y },
      thickness: 0.7,
      color: COLORS.line
    });
    this.y -= 18;
  }

  ensureSpace(height) {
    if (this.y - height >= MARGIN) return;
    this.addPage();
  }

  writeLines(lines, x, width, options = {}) {
    const size = options.size || 9;
    const lineHeight = options.lineHeight || size + 3;
    for (const line of lines) {
      this.ensureSpace(lineHeight);
      this.page.drawText(line, {
        x,
        y: this.y,
        size,
        font: options.bold ? this.bold : this.font,
        color: options.color || COLORS.ink,
        maxWidth: width
      });
      this.y -= lineHeight;
    }
  }

  title(text, subtitle = '') {
    this.ensureSpace(58);
    this.page.drawText(text, {
      x: MARGIN,
      y: this.y,
      size: 18,
      font: this.bold,
      color: COLORS.brand
    });
    this.y -= 22;
    if (subtitle) {
      this.writeLines(wrapText(subtitle, this.font, 9, CONTENT_WIDTH), MARGIN, CONTENT_WIDTH, { size: 9, color: COLORS.muted });
    }
    this.y -= 8;
  }

  section(title) {
    this.ensureSpace(34);
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y - 17,
      width: CONTENT_WIDTH,
      height: 23,
      color: COLORS.soft
    });
    this.page.drawText(title, {
      x: MARGIN + 10,
      y: this.y - 10,
      size: 11,
      font: this.bold,
      color: COLORS.brand
    });
    this.y -= 34;
  }

  field(label, input) {
    const text = compact(input) || 'Not provided';
    const labelWidth = 154;
    const gap = 12;
    const valueWidth = CONTENT_WIDTH - labelWidth - gap;
    const lines = wrapText(text, this.font, 9, valueWidth);
    const height = Math.max(18, lines.length * 12 + 7);
    this.ensureSpace(height);
    const top = this.y;
    this.page.drawText(label, {
      x: MARGIN,
      y: top,
      size: 8.5,
      font: this.bold,
      color: COLORS.muted
    });
    this.writeLines(lines, MARGIN + labelWidth + gap, valueWidth, { size: 9, lineHeight: 12 });
    if (this.y > top - height) this.y = top - height;
    this.page.drawLine({
      start: { x: MARGIN, y: this.y + 3 },
      end: { x: PAGE_SIZE[0] - MARGIN, y: this.y + 3 },
      thickness: 0.35,
      color: COLORS.line
    });
    this.y -= 6;
  }

  rowGroup(label, items = [], columns = []) {
    this.ensureSpace(24);
    this.writeLines([label], MARGIN, CONTENT_WIDTH, { size: 9, bold: true, color: COLORS.muted });
    if (!items.length) {
      this.field('Records', 'None provided');
      return;
    }
    items.forEach((item, index) => {
      const summary = rowSummary(item, columns);
      this.field(`${label} ${index + 1}`, summary);
    });
  }
}

export async function buildApplicationPdf({ payload = {}, role = {}, confirmation = '', uploads = {} } = {}) {
  const doc = await PDFDocument.create();
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold)
  };
  const report = new PdfReport(doc, fonts);
  const personal = payload.personalInformation || {};

  report.title(
    'Completed Employment Application',
    [
      personal.fullName ? `Applicant: ${personal.fullName}` : '',
      role.title ? `Position: ${role.title}` : '',
      confirmation ? `Reference: ${confirmation}` : ''
    ].filter(Boolean).join(' / ')
  );

  for (const section of buildSections(payload, role, confirmation, uploads)) {
    report.section(section.title);
    for (const [label, input] of section.fields || []) {
      report.field(label, input);
    }
    for (const row of section.rows || []) {
      report.rowGroup(row.label, row.items, row.columns);
    }
    report.y -= 8;
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
