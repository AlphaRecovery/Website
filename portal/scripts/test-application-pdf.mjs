// Local check: render a sample application payload to a PDF and save it so the
// layout can be eyeballed. Not used at runtime.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApplicationPdf } from '../server/applicationPdf.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const payload = {
  positionInformation: { roleTitle: 'Quality Control Specialist', desiredStartDate: '2026-07-01', desiredPay: '$55,000 / year', hearAbout: 'Alpha Recovery website' },
  personalInformation: { fullName: 'Test Applicant QC', email: 'qc-test@alpharecovery.org', phone: '(404) 555-0142', ssnLast4: '0000', streetAddress: '123 Test Street', city: 'Atlanta', state: 'GA', zip: '30303' },
  workAuthorization: { authorizedToWork: 'Yes', requireSponsorship: 'No', atLeast18: 'Yes', notes: 'Test application — submitted for portal QA.' },
  education: { highestLevel: 'Associate of Science (AS)', degrees: [{ school: 'Georgia State University', degree: 'Associate of Science (AS)', field: 'Criminal Justice', graduationYear: '2018' }] },
  employmentHistory: { experienceSummary: 'Three years of compliance auditing and case-file review experience.', employers: [{ employer: 'Peachtree Compliance Services', title: 'Compliance Auditor', startDate: '2021-01-15', endDate: '2024-03-30', supervisor: 'Jane Doe', phone: '(404) 555-0188', reasonForLeaving: 'Career advancement', duties: 'Conducted case-level accuracy audits, maintained audit logs, and produced findings summaries that fed performance reporting and corrective action.' }] },
  criminalHistory: { felony: 'No', misdemeanor: 'No', pendingCharges: 'No', deferred: 'No', militaryCourt: 'No', registryRequired: 'No', acknowledgment: true },
  references: [
    { name: 'Jane Doe', relationship: 'Former Supervisor', company: 'Peachtree Compliance Services', phone: '(404) 555-0188', email: 'jane.doe@example.com', yearsKnown: '5' },
    { name: 'John Smith', relationship: 'Colleague', company: 'Peachtree Compliance Services', phone: '(404) 555-0177', email: 'john.smith@example.com', yearsKnown: '4' }
  ],
  backgroundAuthorization: { fullLegalName: 'Test Applicant QC', dateOfBirth: '1990-04-12', socialSecurityNumber: '000-00-0000', currentAddress: '123 Test Street, Atlanta, GA 30303', typedSignature: 'Test Applicant QC', signatureDate: '2026-06-15', printedName: 'Test Applicant QC' },
  signatures: { backgroundAuthorization: true, standardsOfConduct: true, applicantCertification: true },
  applicantCertification: { typedFullLegalName: 'Test Applicant QC', date: '2026-06-15' },
  account: { portalAccountCreated: true }
};

const pdf = await buildApplicationPdf({ payload, role: { title: 'Quality Control Specialist' }, confirmation: 'AD-2026-00000' });
const outDir = path.join(root, 'output');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'sample-application.pdf');
fs.writeFileSync(outFile, pdf);
console.log(`Wrote ${outFile} (${pdf.length} bytes)`);
