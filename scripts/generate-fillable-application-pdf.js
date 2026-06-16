const fs = require('fs');
const path = require('path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const outDir = path.resolve(__dirname, '..', 'output', 'pdf');
const outFile = path.join(outDir, 'alpha-recovery-fillable-employment-application.pdf');

const pageSize = [612, 792];
const margin = 34;
const footerHeight = 22;
const fieldBorder = rgb(0.62, 0.66, 0.72);
const softBg = rgb(0.96, 0.97, 0.99);
const ink = rgb(0.07, 0.09, 0.14);
const muted = rgb(0.31, 0.35, 0.42);
const red = rgb(0.69, 0, 0);
const white = rgb(1, 1, 1);

const CRIMINAL_SCREENING = [
  'Have you ever been convicted of, or pleaded guilty or no contest (nolo contendere) to, a felony?',
  'Have you ever been convicted of, or pleaded guilty or no contest to, a misdemeanor (excluding minor traffic violations)?',
  'Do you currently have any criminal charges pending or unresolved against you in any jurisdiction?',
  'Have you ever received deferred adjudication, diversion, a withheld or suspended judgment, or probation before judgment for a criminal offense?',
  'Have you ever been convicted by a military court-martial or received non-judicial punishment (e.g., Article 15)?',
  'Are you currently required to register on any state or federal offender registry?'
];

const BACKGROUND_ITEMS = [
  ['1. Pre-Employment Screening', 'Alpha Recovery LLC will conduct a pre-employment screening prior to any eAPP initiation, which includes verification of citizenship status, criminal background, credit history, employment references, education credentials, and any applicable licenses or certifications.'],
  ['2. Federal Background Investigation', 'This position requires a federal background investigation processed through the Office of Professional Responsibility, Personnel Security Division (OPR PSD). I understand that I will be required to complete the Standard Form 85P or SF-85PS through the NBIS eAPP system within 72 hours of eAPP initiation; submit three Signature Release Forms generated upon completion of the questionnaire; submit electronic fingerprints at an approved facility or submit two (2) SF-87 Fingerprint Cards; complete the Optional Form 306; complete the SSA-89 form authorizing SSN verification by the Social Security Administration; and complete any additional forms required based on position designation, including PREA-related questionnaires if applicable.'],
  ['3. Residency Requirement', 'I certify that I currently reside in the United States or its Territories, and that I have resided within the United States or its Territories for three (3) or more years out of the last five (5) years, assessed from the date I sign this form.'],
  ['4. Ongoing Disclosure Obligation', 'I understand that if employed, I am required to immediately disclose to Alpha Recovery LLC any arrest or conviction of any crime (felony or misdemeanor), traffic offenses (including DUI), or any other adverse information that may bear on my suitability for this position. Failure to disclose is grounds for immediate removal from assignment.'],
  ['5. Accuracy of Information', 'I certify that all information I have provided in my application and any related forms is true, accurate, and complete to the best of my knowledge. I understand that providing false, misleading, or incomplete information is grounds for immediate disqualification or termination and may constitute a federal offense.'],
  ['6. No Guarantee of Employment', 'I understand that initiating the background investigation process does not constitute an offer of employment. I may not be deployed to any field assignment or granted access to any program-related information until a preliminary fitness determination has been confirmed by OPR PSD.']
];

const STANDARDS = [
  ['Compliance', 'Follow all applicable laws, regulations, contract requirements, company policies, and client instructions.'],
  ['Confidentiality', 'Protect confidential, sensitive, personal, operational, and proprietary information.'],
  ['Authorized Use', 'Use Alpha Recovery systems, records, documents, equipment, and information only for authorized business purposes.'],
  ['Accurate Reporting', 'Provide truthful, accurate, complete, and timely information in reports, records, communications, and case documentation.'],
  ['Conflicts Of Interest', 'Avoid conflicts of interest and promptly disclose any actual or potential conflict.'],
  ['Professional Conduct', 'Treat clients, agencies, partners, coworkers, applicants, contractors, families, and members of the public with professionalism and respect.'],
  ['Workplace Standards', 'Refrain from harassment, discrimination, intimidation, retaliation, threats, or abusive conduct.'],
  ['Integrity', 'Refrain from falsifying records, misrepresenting credentials, withholding material information, or interfering with official reviews, audits, or investigations.'],
  ['Security And Safety', 'Comply with document handling, reporting, safety, security, and chain-of-command requirements.'],
  ['Duty To Report', 'Immediately report known or suspected misconduct, safety concerns, security incidents, data exposure, or policy violations through the appropriate reporting channel.']
];

function wrapText(text, font, size, maxWidth) {
  const words = String(text).replace(/\s+/g, ' ').trim().split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const pdf = await PDFDocument.create();
  const form = pdf.getForm();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
  let page;
  let y;
  let pageNo = 0;

  function addPage() {
    page = pdf.addPage(pageSize);
    pageNo += 1;
    y = pageSize[1] - margin;
    const alpha = 'ALPHA';
    const recovery = ' RECOVERY';
    const brandSize = 22;
    const alphaWidth = serif.widthOfTextAtSize(alpha, brandSize);
    const recoveryWidth = serif.widthOfTextAtSize(recovery, brandSize);
    const brandX = (pageSize[0] - alphaWidth - recoveryWidth) / 2;
    page.drawText(alpha, { x: brandX, y: y - 18, font: serif, size: brandSize, color: red });
    page.drawText(recovery, { x: brandX + alphaWidth, y: y - 18, font: serif, size: brandSize, color: ink });
    page.drawLine({ start: { x: margin, y: y - 34 }, end: { x: pageSize[0] - margin, y: y - 34 }, thickness: 1.5, color: red });
    y -= 48;
  }

  function need(height) {
    if (y - height < margin + footerHeight) addPage();
  }

  function forcePage() {
    if (page) addPage();
  }

  function drawWrapped(text, x, topY, width, size = 8.5, font = regular, color = ink, lineGap = 2) {
    const lines = wrapText(text, font, size, width);
    let cy = topY;
    for (const line of lines) {
      page.drawText(line, { x, y: cy, font, size, color });
      cy -= size + lineGap;
    }
    return topY - cy;
  }

  function section(title) {
    need(34);
    page.drawRectangle({ x: margin, y: y - 18, width: pageSize[0] - margin * 2, height: 18, color: ink });
    page.drawText(title.toUpperCase(), { x: margin + 7, y: y - 13, font: bold, size: 8.5, color: white });
    y -= 27;
  }

  function note(text) {
    const width = pageSize[0] - margin * 2 - 14;
    const h = Math.max(32, wrapText(text, regular, 8, width).length * 10 + 12);
    need(h + 4);
    page.drawRectangle({ x: margin, y: y - h, width: pageSize[0] - margin * 2, height: h, color: softBg, borderColor: fieldBorder, borderWidth: 0.5 });
    drawWrapped(text, margin + 7, y - 13, width, 8, regular, ink);
    y -= h + 8;
  }

  function label(text, x, topY, width) {
    drawWrapped(text, x, topY, width, 6.8, bold, muted, 1);
  }

  function textField(name, x, topY, width, height = 20, multiline = false) {
    const field = form.createTextField(name);
    if (multiline) field.enableMultiline();
    field.addToPage(page, {
      x,
      y: topY - height,
      width,
      height,
      borderColor: fieldBorder,
      borderWidth: 0.7,
      backgroundColor: white,
      textColor: ink
    });
  }

  function field(labelText, name, x, width, height = 20, multiline = false) {
    label(labelText, x, y, width);
    textField(name, x, y - 10, width, height, multiline);
  }

  function row(fields, height = 20, gap = 12) {
    const cols = fields.length;
    const width = (pageSize[0] - margin * 2 - gap * (cols - 1)) / cols;
    const maxH = height + 22;
    need(maxH);
    fields.forEach((item, index) => {
      const x = margin + index * (width + gap);
      field(item[0], item[1], x, width, item[2] || height, item[3] || false);
    });
    y -= maxH;
  }

  function fullField(labelText, name, height = 44) {
    need(height + 20);
    field(labelText, name, margin, pageSize[0] - margin * 2, height, true);
    y -= height + 22;
  }

  function checkbox(name, x, cy, labelText) {
    const cb = form.createCheckBox(name);
    cb.addToPage(page, {
      x,
      y: cy - 2,
      width: 10,
      height: 10,
      borderColor: ink,
      borderWidth: 0.7,
      backgroundColor: white
    });
    page.drawText(labelText, { x: x + 15, y: cy, font: regular, size: 8, color: ink });
  }

  function yesNo(prefix, labelText) {
    need(28);
    drawWrapped(labelText, margin, y, 370, 8.2, bold, ink);
    checkbox(`${prefix}_yes`, pageSize[0] - margin - 92, y - 1, 'Yes');
    checkbox(`${prefix}_no`, pageSize[0] - margin - 44, y - 1, 'No');
    y -= 25;
  }

  function table(title, columns, rows, prefix, rowHeight = 21) {
    const titleH = title ? 14 : 0;
    const headerH = 16;
    const totalH = titleH + headerH + rows * rowHeight + 8;
    need(totalH);
    if (title) {
      page.drawText(title, { x: margin, y, font: bold, size: 9, color: ink });
      y -= titleH;
    }
    const totalW = pageSize[0] - margin * 2;
    const colW = totalW / columns.length;
    columns.forEach((col, i) => {
      const x = margin + i * colW;
      page.drawRectangle({ x, y: y - headerH, width: colW, height: headerH, color: softBg, borderColor: fieldBorder, borderWidth: 0.5 });
      drawWrapped(col, x + 3, y - 10, colW - 6, 6.3, bold, muted, 0.5);
    });
    y -= headerH;
    for (let r = 0; r < rows; r += 1) {
      columns.forEach((_, c) => {
        const name = `${prefix}_${r + 1}_${c + 1}`;
        textField(name, margin + c * colW, y, colW, rowHeight, true);
      });
      y -= rowHeight;
    }
    y -= 8;
  }

  function paragraph(text, size = 8.5) {
    const width = pageSize[0] - margin * 2;
    const h = wrapText(text, regular, size, width).length * (size + 2);
    need(h + 6);
    drawWrapped(text, margin, y, width, size, regular, ink);
    y -= h + 6;
  }

  function signatureRow(prefix, labels) {
    const width = (pageSize[0] - margin * 2 - 24) / 3;
    need(42);
    labels.forEach((item, i) => {
      const x = margin + i * (width + 12);
      field(item, `${prefix}_${i + 1}`, x, width, 20);
    });
    y -= 42;
  }

  addPage();

  section('1. Position Information');
  row([
    ['Position Applying For', 'position_roleTitle'],
    ['Department', 'position_department'],
    ['Location', 'position_location'],
    ['Employment Type', 'position_employmentType']
  ], 18);
  row([
    ['Desired Start Date', 'position_desiredStartDate'],
    ['Desired Salary or Hourly Rate', 'position_desiredPay'],
    ['How did you hear about us? Alpha Recovery website / Referral / LinkedIn / Indeed / Recruiter / Other', 'position_heardAboutUs']
  ], 18);

  section('2. Personal Information');
  row([
    ['Full Legal Name', 'personal_fullName'],
    ['Email', 'personal_email'],
    ['Phone', 'personal_phone'],
    ['Last 4 of SSN', 'personal_ssnLast4']
  ], 18);
  row([
    ['Street Address', 'personal_address'],
    ['City', 'personal_city'],
    ['State', 'personal_state'],
    ['ZIP', 'personal_zip']
  ], 18);

  section('3. Work Authorization and Eligibility');
  yesNo('work_authorized', 'Authorized to work in the United States?');
  yesNo('work_sponsorship', 'Will you require sponsorship?');
  yesNo('work_age18', 'Are you at least 18 years of age?');
  fullField('Eligibility Notes', 'work_proof', 42);

  section('4. Availability');
  row([
    ['Travel Availability', 'availability_travelAvailability'],
    ['Reliable Transportation', 'availability_reliableTransportation'],
    ['Valid Driver\'s License', 'availability_validDriversLicense'],
    ['Vehicle Insurance', 'availability_vehicleInsurance']
  ], 18);
  fullField('Schedule Notes', 'availability_scheduleNotes', 42);

  section('5. Military Service');
  yesNo('military_served', 'Have you served in the U.S. Armed Forces?');
  row([
    ['Branch', 'military_branch'],
    ['Other Branch', 'military_branchOther'],
    ['Status / Discharge Type', 'military_dischargeType'],
    ['Disabled Veteran Status', 'military_disabledVeteran']
  ], 18);
  fullField('Explain Other Discharge Type', 'military_dischargeOther', 40);

  section('6. Education');
  row([['Highest Education Level', 'education_highestLevel']], 18);
  table('Education History', ['School', 'Degree', 'Field', 'Graduation Date'], 4, 'education_degrees');

  section('7. Professional Licenses and Certifications');
  table('Certification Details', ['License/Certification Name', 'License Number', 'State', 'Expiration Date', 'Current Status'], 5, 'certifications_records');
  table('Languages', ['Language', 'Proficiency', 'Speak/Read/Write/Interpret/Translate', 'Certification'], 4, 'languages_records');

  section('8. Employment History');
  note('This position requires the relevant experience stated in the role posting. Document employment dates clearly and attach additional pages if needed.');
  row([
    ['Calculated Relevant Experience', 'employment_yearsRelevantExperience'],
    ['Experience Summary', 'employment_summary', 42, true]
  ], 42);
  table('Employers', ['Employer', 'Title', 'Start Date', 'End Date', 'Supervisor', 'Phone', 'Reason for Leaving'], 5, 'employment_employers', 20);
  fullField('Duties - Additional Detail', 'employment_dutiesAdditional', 56);

  section('9. Government Contract Eligibility');
  yesNo('government_priorContractWork', 'Prior Government Contract Work');
  row([
    ['Agency / Contract', 'government_agency'],
    ['Clearance Held', 'government_clearanceHeld'],
    ['Debarred or excluded from federal contracting?', 'government_debarred']
  ], 18);
  fullField('Notes', 'government_notes', 42);

  section('10. Criminal History Questionnaire');
  note('Fair-chance notice. Alpha Recovery LLC performs background-sensitive and government-contract work, so criminal history is collected as a job-related part of the screening process. A criminal record does not automatically disqualify you. Each disclosure is assessed individually based on the nature and gravity of the offense, the time that has passed, and its relevance to the duties of the position, including any evidence of rehabilitation. You are not required to disclose: arrests that did not lead to a conviction (except where job-related and permitted by law); records that have been sealed, expunged, dismissed, eradicated, or annulled; or convictions for which you received a full pardon, in any jurisdiction where such inquiry is prohibited.');
  CRIMINAL_SCREENING.forEach((question, index) => yesNo(`criminal_${index + 1}`, question));
  paragraph('Offense Details: List each offense you answered "Yes" to above. Provide one entry per offense. If a field does not apply, enter "N/A".', 8.3);
  table('Offense Details', ['Offense Type', 'Charge / Offense', 'Date', 'Jurisdiction', 'Court', 'Disposition', 'Sentence / Penalty', 'Current Status', 'Circumstances / Rehabilitation / Restitution'], 3, 'criminal_offenses', 26);
  note('I certify that the answers given in this section are true, accurate, and complete to the best of my knowledge. I understand that knowingly providing false, incomplete, or misleading information, or omitting a required disclosure, is grounds for rejecting this application or, if discovered after hire, for withdrawal of an offer or termination of employment or contract. I understand that any disclosed record will be evaluated individually and will not automatically bar consideration.');
  checkbox('criminal_acknowledgment', margin, y - 8, 'I have read and understand the notice above, and I have answered every question in this section truthfully and completely.');
  y -= 30;

  section('11. Driving Record');
  yesNo('driving_validLicense', 'Valid Driver\'s License?');
  row([
    ['License Number', 'driving_licenseNumber'],
    ['State', 'driving_state'],
    ['CDL?', 'driving_cdl'],
    ['Moving Violations in Last 5 Years', 'driving_movingViolations'],
    ['Accidents in Last 5 Years', 'driving_accidents']
  ], 18);
  fullField('DUI History', 'driving_duiHistory', 42);

  forcePage();
  section('12. Professional References');
  table('References', ['Name', 'Relationship', 'Company', 'Phone', 'Email', 'Years Known'], 8, 'references', 24);

  forcePage();
  section('13. Background Investigation Authorization');
  note('APPLICANT INFORMATION');
  row([
    ['Full Legal Name', 'background_fullLegalName'],
    ['Date of Birth', 'background_dateOfBirth'],
    ['Social Security Number', 'background_socialSecurityNumber'],
    ['Current Address', 'background_currentAddress'],
    ['Position Applied For', 'background_positionAppliedFor']
  ], 18);
  paragraph('Authorization And Consent - Background Investigation Authorization', 9);
  paragraph('I, the undersigned, hereby authorize Alpha Recovery LLC and its designated agents to conduct a pre-employment background investigation and, if selected for employment, to initiate the federal background investigation process required for this position.', 8.3);
  BACKGROUND_ITEMS.forEach(([title, body]) => {
    paragraph(`${title}: ${body}`, 7.8);
  });
  note('By signing below, I acknowledge that I have read, understand, and consent to the terms above. I authorize Alpha Recovery LLC and authorized federal agencies to conduct all investigations necessary to determine my suitability for this position.');
  signatureRow('background_signature', ['Typed Signature', 'Date', 'Printed Name']);

  forcePage();
  section('14. Standards of Conduct');
  paragraph('Applicant Acknowledgment - Professional Standards', 9);
  paragraph('By signing below, I acknowledge that if I am selected for employment, contract work, or assignment with Alpha Recovery LLC, I will be expected to conduct myself with professionalism, integrity, accountability, and respect at all times.', 8.3);
  STANDARDS.forEach(([title, body]) => paragraph(`${title}: ${body}`, 7.8));
  note('I understand that failure to comply with these standards may result in removal from consideration, withdrawal of an offer, termination of employment or contract relationship, removal from assignment, denial of future work opportunities, and/or referral to appropriate authorities where required by law or contract.');
  paragraph('Standards of Conduct requires your typed full legal name as an electronic signature.', 8.3);
  row([['Typed Full Legal Name', 'standards_typedFullLegalName']], 18);

  forcePage();
  section('15. Applicant Certification');
  paragraph('Certification Of Accuracy - Final Applicant Certification', 9);
  note('I certify that all information provided in this application, including any attachments, supplemental forms, and supporting documentation, is true, accurate, and complete to the best of my knowledge.');
  paragraph('Any false, misleading, or incomplete statement made in connection with this application may result in disqualification from consideration, withdrawal of any offer extended, or termination of employment or assignment if discovered after hiring.', 8.3);
  paragraph('Alpha Recovery LLC reserves the right to verify any information provided at any point during the application, hiring, or onboarding process.', 8.3);
  paragraph('Omission of material information is treated with the same consequence as a false statement.', 8.3);
  note('By typing my full legal name below, I certify that the statements made in this application are true, accurate, and complete.');
  signatureRow('applicant_certification', ['Typed Full Legal Name', 'Date', 'Applicant Signature']);

  section('Document Upload Checklist');
  [
    'Resume',
    'Driver\'s License',
    'Degree / Transcript',
    'Military Documentation',
    'Certifications selected in Section 7',
    'Security License',
    'Social Work License',
    'Language Certifications'
  ].forEach((item, index) => {
    need(18);
    checkbox(`upload_${index + 1}`, margin, y - 4, item);
    y -= 16;
  });

  const pages = pdf.getPages();
  const totalPages = pages.length;
  pages.forEach((pdfPage, index) => {
    const footerY = 22;
    const label = `Page ${index + 1} of ${totalPages}`;
    const labelWidth = regular.widthOfTextAtSize(label, 8);
    pdfPage.drawLine({
      start: { x: margin, y: footerY + 12 },
      end: { x: pageSize[0] - margin, y: footerY + 12 },
      thickness: 0.5,
      color: fieldBorder
    });
    pdfPage.drawText(label, {
      x: (pageSize[0] - labelWidth) / 2,
      y: footerY,
      font: regular,
      size: 8,
      color: muted
    });
  });

  form.updateFieldAppearances(regular);
  const bytes = await pdf.save();
  fs.writeFileSync(outFile, bytes);
  console.log(outFile);
  console.log(`fields=${form.getFields().length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
