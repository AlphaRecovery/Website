import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(__dirname, 'templates', 'alpha-recovery-application.pdf');

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
    return null;
  }
}

function setText(form, name, input) {
  const field = getField(form, name);
  if (!field) return;
  field.setText(value(input));
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

function fillRows(form, prefix, rows = [], columns = [], maxRows = rows.length) {
  rows.slice(0, maxRows).forEach((row, index) => {
    columns.forEach((keys, columnIndex) => {
      setText(form, `${prefix}_${index + 1}_${columnIndex + 1}`, rowValue(row, Array.isArray(keys) ? keys : [keys]));
    });
  });
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

function uploadedFieldNames(payload = {}) {
  return Object.keys(payload.uploads || {}).filter((key) => {
    const item = payload.uploads?.[key];
    if (Array.isArray(item)) return item.length > 0;
    return !!item;
  });
}

export async function buildApplicationPdf({ payload = {}, role = {}, confirmation = '' } = {}) {
  const template = await fs.readFile(TEMPLATE_PATH);
  const doc = await PDFDocument.load(template);
  const form = doc.getForm();
  const font = await doc.embedFont(StandardFonts.Helvetica);

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

  setText(form, 'position_roleTitle', role.title || position.roleTitle);
  setText(form, 'position_department', role.department || position.department);
  setText(form, 'position_location', role.location || position.location);
  setText(form, 'position_employmentType', role.employmentType || position.employmentType);
  setText(form, 'position_desiredStartDate', position.desiredStartDate);
  setText(form, 'position_desiredPay', position.desiredPay);
  setText(form, 'position_heardAboutUs', position.heardAboutUs);

  setText(form, 'personal_fullName', personal.fullName);
  setText(form, 'personal_email', personal.email);
  setText(form, 'personal_phone', personal.phone);
  setText(form, 'personal_ssnLast4', personal.ssnLast4);
  setText(form, 'personal_address', personal.address);
  setText(form, 'personal_city', personal.city);
  setText(form, 'personal_state', personal.state);
  setText(form, 'personal_zip', personal.zip);

  setYesNo(form, 'work_authorized', work.authorized);
  setYesNo(form, 'work_sponsorship', work.sponsorship);
  setYesNo(form, 'work_age18', work.age18);
  setText(form, 'work_proof', work.proof);

  setText(form, 'availability_travelAvailability', availability.travelAvailability);
  setText(form, 'availability_reliableTransportation', availability.reliableTransportation);
  setText(form, 'availability_validDriversLicense', availability.validDriversLicense);
  setText(form, 'availability_vehicleInsurance', availability.vehicleInsurance);
  setText(form, 'availability_scheduleNotes', availability.scheduleNotes);

  setYesNo(form, 'military_served', military.served);
  setText(form, 'military_branch', military.branch);
  setText(form, 'military_branchOther', military.branchOther);
  setText(form, 'military_dischargeType', military.dischargeType);
  setText(form, 'military_disabledVeteran', military.disabledVeteran);
  setText(form, 'military_dischargeOther', military.dischargeOther);

  setText(form, 'education_highestLevel', education.highestLevel);
  fillRows(form, 'education_degrees', education.degrees || [], ['school', 'degree', 'field', ['graduationYear', 'graduationDate']], 4);

  fillRows(form, 'certifications_records', certificationRows(payload), ['group', ['name', 'certification'], ['licenseNumber', 'number'], 'state', ['expirationDate', 'status']], 5);
  fillRows(form, 'languages_records', payload.languages || [], ['language', 'proficiency', 'skills', 'certification'], 4);

  setText(form, 'employment_yearsRelevantExperience', employment.yearsRelevantExperience);
  setText(form, 'employment_summary', employment.summary);
  fillRows(form, 'employment_employers', employment.employers || [], ['employer', 'title', 'startDate', 'endDate', 'supervisor', 'phone', 'reasonForLeaving'], 5);
  setText(form, 'employment_dutiesAdditional', additionalEmployerDuties(employment.employers || []));

  setYesNo(form, 'government_priorContractWork', government.priorGovernmentContractWork);
  setText(form, 'government_agency', government.agency);
  setText(form, 'government_clearanceHeld', government.clearanceHeld);
  setText(form, 'government_debarred', government.debarred);
  setText(form, 'government_notes', government.notes);

  [
    criminal.felonyConviction,
    criminal.misdemeanorConviction,
    criminal.pendingCharges,
    criminal.deferredAdjudication,
    criminal.militaryCourtMartial,
    criminal.registryRequired
  ].forEach((answer, index) => setYesNo(form, `criminal_${index + 1}`, answer));
  fillRows(form, 'criminal_offenses', criminal.offenses || [], ['type', 'offense', 'offenseDate', 'jurisdiction', 'court', 'disposition', 'sentence', 'status', 'context'], 3);
  setCheckbox(form, 'criminal_acknowledgment', !!criminal.acknowledgment);

  setYesNo(form, 'driving_validLicense', driving.validLicense);
  setText(form, 'driving_licenseNumber', driving.licenseNumber);
  setText(form, 'driving_state', driving.state);
  setText(form, 'driving_cdl', driving.cdl);
  setText(form, 'driving_movingViolations', driving.movingViolations);
  setText(form, 'driving_accidents', driving.accidents);
  setText(form, 'driving_duiHistory', driving.duiHistory);

  fillRows(form, 'references', payload.references || [], ['name', 'relationship', 'company', 'phone', 'email', 'yearsKnown'], 8);

  setText(form, 'background_fullLegalName', background.fullLegalName);
  setText(form, 'background_dateOfBirth', background.dateOfBirth);
  setText(form, 'background_socialSecurityNumber', background.socialSecurityNumber);
  setText(form, 'background_currentAddress', background.currentAddress);
  setText(form, 'background_positionAppliedFor', role.title || background.positionAppliedFor);
  setText(form, 'background_signature_1', background.typedSignature || signatures.backgroundAuthorization);
  setText(form, 'background_signature_2', background.signatureDate);
  setText(form, 'background_signature_3', background.printedName);

  setText(form, 'standards_typedFullLegalName', signatures.standardsOfConduct || payload.standardsOfConduct?.typedFullLegalName);
  setText(form, 'applicant_certification_1', applicantCertification.typedFullLegalName || signatures.applicantCertification);
  setText(form, 'applicant_certification_2', applicantCertification.date);
  setText(form, 'applicant_certification_3', confirmation);

  uploadedFieldNames(payload).slice(0, 8).forEach((_, index) => setCheckbox(form, `upload_${index + 1}`, true));

  form.updateFieldAppearances(font);
  form.flatten();

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
