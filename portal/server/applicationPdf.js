import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(__dirname, 'templates', 'alpha-recovery-application.pdf');
const warnedMissingFields = new Set();
const CONTINUED_MARKER = ' [continued]';

function value(input) {
  if (input === null || input === undefined) return '';
  if (Array.isArray(input)) return input.filter(Boolean).join(', ');
  return String(input);
}

function yesNo(input) {
  const clean = value(input).trim().toLowerCase();
  if (clean === 'yes' || clean === 'true') return 'yes';
  if (clean === 'no' || clean === 'false') return 'no';
  return '';
}

function getField(form, name) {
  try {
    return form.getField(name);
  } catch {
    if (!warnedMissingFields.has(name)) {
      warnedMissingFields.add(name);
      console.warn(`[application-pdf] Missing PDF template field: ${name}`);
    }
    return null;
  }
}

function fieldRectangle(field) {
  try {
    return field.acroField.getWidgets()[0]?.getRectangle() || null;
  } catch {
    return null;
  }
}

function compactText(input) {
  return value(input).replace(/\s+/g, ' ').trim();
}

function lineFits(font, text, size, width) {
  return font.widthOfTextAtSize(text, size) <= width;
}

function wrapTextToWidth(text, font, size, width) {
  const words = compactText(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || lineFits(font, candidate, size, width)) {
      line = candidate;
      continue;
    }
    lines.push(line);
    if (lineFits(font, word, size, width)) {
      line = word;
    } else {
      let chunk = '';
      for (const char of word) {
        const next = `${chunk}${char}`;
        if (!chunk || lineFits(font, next, size, width)) {
          chunk = next;
        } else {
          lines.push(chunk);
          chunk = char;
        }
      }
      line = chunk;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function fieldTextPreview(field, input, font, options = {}) {
  const text = compactText(input);
  if (!text || !font) return { text, overflowed: false };

  const rect = fieldRectangle(field);
  if (!rect) return { text, overflowed: false };

  const fontSize = options.fontSize || 7.5;
  const lineHeight = options.lineHeight || 9;
  const width = Math.max(16, rect.width - 8);
  const height = Math.max(lineHeight, rect.height - 5);
  const maxLines = options.multiline ? Math.max(1, Math.floor(height / lineHeight)) : 1;
  const lines = wrapTextToWidth(text, font, fontSize, width);
  if (lines.length <= maxLines && lines.join(' ') === text) {
    return { text: options.multiline ? lines.join('\n') : text, overflowed: false };
  }

  let low = 0;
  let high = text.length;
  let best = '';
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = `${text.slice(0, mid).trimEnd()}${CONTINUED_MARKER}`;
    const candidateLines = wrapTextToWidth(candidate, font, fontSize, width);
    if (candidateLines.length <= maxLines) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return {
    text: options.multiline ? wrapTextToWidth(best || CONTINUED_MARKER.trim(), font, fontSize, width).slice(0, maxLines).join('\n') : (best || CONTINUED_MARKER.trim()),
    overflowed: true
  };
}

function setText(form, name, input, options = {}) {
  const field = getField(form, name);
  if (!field) return;
  if (options.multiline && typeof field.enableMultiline === 'function') field.enableMultiline();
  const preview = fieldTextPreview(field, input, options.font, options);
  field.setText(preview.text);
  if (preview.overflowed && options.overflow) {
    options.overflow.push(`${options.label || name}: ${compactText(input)}`);
  }
}

function setCheckbox(form, name, checked) {
  const field = getField(form, name);
  if (!field) return;
  if (checked) field.check();
  else field.uncheck();
}

function setYesNo(form, prefix, input) {
  const answer = yesNo(input);
  setCheckbox(form, `${prefix}_yes`, answer === 'yes');
  setCheckbox(form, `${prefix}_no`, answer === 'no');
}

function rowValue(row, keys) {
  return keys.map((key) => value(row?.[key])).find(Boolean) || '';
}

function fieldLabel(keys) {
  const key = Array.isArray(keys) ? keys[0] : keys;
  return String(key || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
}

function fillRows(form, prefix, rows = [], columns = [], maxRows = rows.length, options = {}) {
  rows.slice(0, maxRows).forEach((row, index) => {
    columns.forEach((keys, columnIndex) => {
      setText(form, `${prefix}_${index + 1}_${columnIndex + 1}`, rowValue(row, Array.isArray(keys) ? keys : [keys]), {
        ...options,
        label: `${options.title || prefix} ${index + 1} - ${fieldLabel(keys)}`
      });
    });
  });
}

function rowSummary(row, columns = []) {
  const parts = columns
    .map((keys) => {
      const label = Array.isArray(keys) ? keys[0] : keys;
      const inputKeys = Array.isArray(keys) ? keys.slice(1) : [keys];
      const text = rowValue(row, inputKeys.length ? inputKeys : [label]);
      return text ? `${label}: ${text}` : '';
    })
    .filter(Boolean);
  return parts.join('; ') || value(row);
}

function overflowSection(title, rows = [], maxRows, columns) {
  const overflow = rows.slice(maxRows);
  if (!overflow.length) return null;
  return {
    title,
    rows: overflow.map((row, index) => `${maxRows + index + 1}. ${rowSummary(row, columns)}`)
  };
}

function overflowSections(payload = {}) {
  const education = payload.education || {};
  const employment = payload.employmentHistory || {};
  const criminal = payload.criminalHistory || {};
  const sections = [
    education.useExperienceAlternative ? {
      title: 'Education Requirement Alternative',
      rows: [
        'Applicant requested to use 10+ years of relevant experience as an alternative to the education requirement.',
        'A separate experience narrative upload is required for this option.'
      ]
    } : null,
    overflowSection('Additional Education Records', education.degrees || [], 4, ['school', 'degree', 'field', ['graduation', 'graduationYear', 'graduationDate']]),
    overflowSection('Additional Certifications', certificationRows(payload), 5, ['group', ['name', 'certification'], ['license', 'licenseNumber', 'number'], 'state', ['expiration', 'expirationDate', 'status']]),
    overflowSection('Additional Language Profiles', payload.languages || [], 4, ['language', 'proficiency', 'skills', 'certification']),
    overflowSection('Additional Employers', employment.employers || [], 5, ['employer', 'title', 'startDate', 'endDate', 'supervisor', 'phone', 'reasonForLeaving', 'duties']),
    overflowSection('Additional Criminal History Offenses', criminal.offenses || [], 3, ['type', 'offense', 'offenseDate', 'jurisdiction', 'court', 'disposition', 'sentence', 'status', 'context']),
    overflowSection('Additional References', payload.references || [], 8, ['name', 'relationship', 'company', 'phone', 'email', 'yearsKnown'])
  ];
  return sections.filter(Boolean);
}

function wrapLine(text, maxCharacters = 96) {
  const words = value(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if (!line) {
      line = word;
    } else if (`${line} ${word}`.length <= maxCharacters) {
      line = `${line} ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function drawOverflowPages(doc, font, sections = [], confirmation = '') {
  if (!sections.length) return;
  const pageSize = [612, 792];
  const margin = 44;
  const lineHeight = 13;
  let page = doc.addPage(pageSize);
  let y = pageSize[1] - margin;

  const ensureSpace = (needed = lineHeight) => {
    if (y - needed >= margin) return;
    page = doc.addPage(pageSize);
    y = pageSize[1] - margin;
  };

  const write = (text, options = {}) => {
    const size = options.size || 9;
    const lines = wrapLine(text, options.maxCharacters || 96);
    for (const line of lines) {
      ensureSpace(lineHeight);
      page.drawText(line, {
        x: margin,
        y,
        size,
        font,
        color: options.color || rgb(0.12, 0.12, 0.12)
      });
      y -= lineHeight;
    }
  };

  write('Alpha Recovery Employment Application - Overflow Summary', { size: 13, maxCharacters: 80 });
  if (confirmation) write(`Reference: ${confirmation}`, { size: 10, maxCharacters: 80 });
  y -= 8;

  for (const section of sections) {
    ensureSpace(32);
    write(section.title, { size: 11, maxCharacters: 80, color: rgb(0, 0, 0) });
    for (const row of section.rows) write(row);
    y -= 6;
  }
}

function additionalEmployerDuties(employers = []) {
  return employers.slice(0, 5)
    .map((row, index) => value(row?.duties) ? `Employer ${index + 1}: ${value(row.duties)}` : '')
    .filter(Boolean)
    .join('\n');
}

function certificationRows(payload = {}) {
  const records = payload.certifications?.records || [];
  const selected = payload.certifications?.selected || [];
  if (records.length) return records;
  return selected.map((name) => ({ name }));
}

function uploadedFieldNames(payload = {}, uploads = {}) {
  const payloadFields = Object.keys(payload.uploads || {}).filter((key) => {
    const item = payload.uploads?.[key];
    if (Array.isArray(item)) return item.length > 0;
    return !!item;
  });
  const fileFields = Object.keys(uploads || {}).filter((key) => Array.isArray(uploads[key]) && uploads[key].length > 0);
  return [...new Set([...payloadFields, ...fileFields])];
}

export async function buildApplicationPdf({ payload = {}, role = {}, confirmation = '', uploads = {} } = {}) {
  const template = await fs.readFile(TEMPLATE_PATH);
  const doc = await PDFDocument.load(template);
  const form = doc.getForm();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const continuedAnswers = [];
  const textOptions = { font, overflow: continuedAnswers };
  const setPdfText = (name, input, label, options = {}) => setText(form, name, input, {
    ...textOptions,
    ...options,
    label: label || name
  });
  const rowOptions = (title) => ({ ...textOptions, title });

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

  setPdfText('position_roleTitle', role.title || position.roleTitle, 'Position - Role title');
  setPdfText('position_department', role.department || position.department, 'Position - Department');
  setPdfText('position_location', role.location || position.location, 'Position - Location');
  setPdfText('position_employmentType', role.employmentType || position.employmentType, 'Position - Employment type');
  setPdfText('position_desiredStartDate', position.desiredStartDate, 'Position - Desired start date');
  setPdfText('position_desiredPay', position.desiredPay, 'Position - Desired pay');
  setPdfText('position_heardAboutUs', position.heardAboutUs, 'Position - Heard about us');

  setPdfText('personal_fullName', personal.fullName, 'Personal - Full name');
  setPdfText('personal_email', personal.email, 'Personal - Email');
  setPdfText('personal_phone', personal.phone, 'Personal - Phone');
  setPdfText('personal_ssnLast4', personal.ssnLast4, 'Personal - SSN last 4');
  setPdfText('personal_address', personal.address, 'Personal - Address');
  setPdfText('personal_city', personal.city, 'Personal - City');
  setPdfText('personal_state', personal.state, 'Personal - State');
  setPdfText('personal_zip', personal.zip, 'Personal - ZIP');

  setYesNo(form, 'work_authorized', work.authorized);
  setYesNo(form, 'work_sponsorship', work.sponsorship);
  setYesNo(form, 'work_age18', work.age18);
  setPdfText('work_proof', work.proof, 'Work authorization - Proof notes', { multiline: true });

  setPdfText('availability_travelAvailability', availability.travelAvailability, 'Availability - Travel availability');
  setPdfText('availability_reliableTransportation', availability.reliableTransportation, 'Availability - Reliable transportation');
  setPdfText('availability_validDriversLicense', availability.validDriversLicense, "Availability - Valid driver's license");
  setPdfText('availability_vehicleInsurance', availability.vehicleInsurance, 'Availability - Vehicle insurance');
  setPdfText('availability_scheduleNotes', availability.scheduleNotes, 'Availability - Schedule notes', { multiline: true });

  setYesNo(form, 'military_served', military.served);
  setPdfText('military_branch', military.branch, 'Military - Branch');
  setPdfText('military_branchOther', military.branchOther, 'Military - Other branch');
  setPdfText('military_dischargeType', military.dischargeType, 'Military - Discharge type');
  setPdfText('military_disabledVeteran', military.disabledVeteran, 'Military - Disabled veteran');
  setPdfText('military_dischargeOther', military.dischargeOther, 'Military - Discharge notes', { multiline: true });

  setPdfText('education_highestLevel', education.highestLevel, 'Education - Highest level');
  fillRows(form, 'education_degrees', education.degrees || [], ['school', 'degree', 'field', ['graduationYear', 'graduationDate']], 4, rowOptions('Education'));

  fillRows(form, 'certifications_records', certificationRows(payload), ['group', ['name', 'certification'], ['licenseNumber', 'number'], 'state', ['expirationDate', 'status']], 5, rowOptions('Certification'));
  fillRows(form, 'languages_records', payload.languages || [], ['language', 'proficiency', 'skills', 'certification'], 4, rowOptions('Language'));

  setPdfText('employment_yearsRelevantExperience', employment.yearsRelevantExperience, 'Employment - Years relevant experience', { multiline: true });
  setPdfText('employment_summary', employment.summary, 'Employment - Summary', { multiline: true });
  fillRows(form, 'employment_employers', employment.employers || [], ['employer', 'title', 'startDate', 'endDate', 'supervisor', 'phone', 'reasonForLeaving'], 5, rowOptions('Employer'));
  setPdfText('employment_dutiesAdditional', additionalEmployerDuties(employment.employers || []), 'Employment - Duties and responsibilities', { multiline: true });

  setYesNo(form, 'government_priorContractWork', government.priorGovernmentContractWork);
  setPdfText('government_agency', government.agency, 'Government eligibility - Agency');
  setPdfText('government_clearanceHeld', government.clearanceHeld, 'Government eligibility - Clearance held');
  setPdfText('government_debarred', government.debarred, 'Government eligibility - Debarred');
  setPdfText('government_notes', government.notes, 'Government eligibility - Notes', { multiline: true });

  [
    criminal.felonyConviction,
    criminal.misdemeanorConviction,
    criminal.pendingCharges,
    criminal.deferredAdjudication,
    criminal.militaryCourtMartial,
    criminal.registryRequired
  ].forEach((answer, index) => setYesNo(form, `criminal_${index + 1}`, answer));
  fillRows(form, 'criminal_offenses', criminal.offenses || [], ['type', 'offense', 'offenseDate', 'jurisdiction', 'court', 'disposition', 'sentence', 'status', 'context'], 3, rowOptions('Criminal history offense'));
  setCheckbox(form, 'criminal_acknowledgment', !!criminal.acknowledgment);

  setYesNo(form, 'driving_validLicense', driving.validLicense);
  setPdfText('driving_licenseNumber', driving.licenseNumber, "Driving - Driver's license number");
  setPdfText('driving_state', driving.state, 'Driving - State');
  setPdfText('driving_cdl', driving.cdl, 'Driving - CDL');
  setPdfText('driving_movingViolations', driving.movingViolations, 'Driving - Moving violations');
  setPdfText('driving_accidents', driving.accidents, 'Driving - Accidents');
  setPdfText('driving_duiHistory', driving.duiHistory, 'Driving - DUI history', { multiline: true });

  fillRows(form, 'references', payload.references || [], ['name', 'relationship', 'company', 'phone', 'email', 'yearsKnown'], 8, rowOptions('Reference'));

  setPdfText('background_fullLegalName', background.fullLegalName, 'Background authorization - Full legal name');
  setPdfText('background_dateOfBirth', background.dateOfBirth, 'Background authorization - Date of birth');
  setPdfText('background_socialSecurityNumber', background.socialSecurityNumber, 'Background authorization - Social security number');
  setPdfText('background_currentAddress', background.currentAddress, 'Background authorization - Current address');
  setPdfText('background_positionAppliedFor', role.title || background.positionAppliedFor, 'Background authorization - Position applied for');
  setPdfText('background_signature_1', background.typedSignature || signatures.backgroundAuthorization, 'Background authorization - Signature');
  setPdfText('background_signature_2', background.signatureDate, 'Background authorization - Signature date');
  setPdfText('background_signature_3', background.printedName, 'Background authorization - Printed name');

  setPdfText('standards_typedFullLegalName', signatures.standardsOfConduct || payload.standardsOfConduct?.typedFullLegalName, 'Standards of conduct - Typed full legal name');
  setPdfText('applicant_certification_1', applicantCertification.typedFullLegalName || signatures.applicantCertification, 'Applicant certification - Typed full legal name');
  setPdfText('applicant_certification_2', applicantCertification.date, 'Applicant certification - Date');
  setPdfText('applicant_certification_3', confirmation, 'Applicant certification - Reference number');

  uploadedFieldNames(payload, uploads).slice(0, 8).forEach((_, index) => setCheckbox(form, `upload_${index + 1}`, true));
  const sections = overflowSections(payload);
  if (continuedAnswers.length) {
    sections.push({ title: 'Continued Field Answers', rows: continuedAnswers });
  }
  drawOverflowPages(doc, font, sections, confirmation);

  form.updateFieldAppearances(font);
  form.flatten();

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
