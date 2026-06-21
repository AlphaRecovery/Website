// Local check: render a sample application payload to a PDF and save it so the
// layout can be eyeballed. Also runs in `npm run check` as a smoke test for the
// PDF field names used by the live application form.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApplicationPdf } from '../server/applicationPdf.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const payload = {
  positionInformation: {
    roleTitle: 'Quality Control Specialist',
    desiredStartDate: '2026-07-01',
    desiredPay: '$55,000 / year',
    heardAboutUs: 'Alpha Recovery website'
  },
  personalInformation: {
    fullName: 'Test Applicant QC',
    email: 'qc-test@alpharecovery.org',
    phone: '(404) 555-0142',
    ssnLast4: '0000',
    address: '123 Test Street',
    city: 'Atlanta',
    state: 'GA',
    zip: '30303'
  },
  workAuthorization: {
    authorized: 'Yes',
    sponsorship: 'No',
    age18: 'Yes',
    proof: 'Test application - submitted for portal QA.'
  },
  availability: {
    travelAvailability: 'None',
    reliableTransportation: 'Yes',
    validDriversLicense: 'Yes',
    vehicleInsurance: 'Yes',
    scheduleNotes: 'Weekday availability.'
  },
  militaryService: {
    served: 'No',
    branch: '',
    branchOther: '',
    dischargeType: '',
    dischargeOther: '',
    disabledVeteran: ''
  },
  education: {
    highestLevel: 'Associate of Science (AS)',
    degrees: [{ school: 'Georgia State University', degree: 'Associate of Science (AS)', field: 'Criminal Justice', graduationYear: '2018' }]
  },
  certifications: {
    selected: ['Certified Fraud Examiner'],
    records: [{ group: 'Compliance', name: 'Certified Fraud Examiner', licenseNumber: 'CFE-12345', state: 'GA', expirationDate: '2027-12-31', status: 'Active' }]
  },
  languages: [{ language: 'Spanish', proficiency: 'Professional', skills: ['Read', 'Write', 'Speak'], certification: 'Internal assessment' }],
  employmentHistory: {
    yearsRelevantExperience: '3',
    summary: 'Three years of compliance auditing and case-file review experience.',
    employers: [{ employer: 'Peachtree Compliance Services', title: 'Compliance Auditor', startDate: '2021-01-15', endDate: '2024-03-30', supervisor: 'Jane Doe', phone: '(404) 555-0188', reasonForLeaving: 'Career advancement', duties: 'Conducted case-level accuracy audits, maintained audit logs, and produced findings summaries.' }]
  },
  governmentEligibility: {
    priorGovernmentContractWork: 'No',
    agency: '',
    clearanceHeld: 'No',
    debarred: 'No',
    notes: 'No prior government contract work.'
  },
  criminalHistory: {
    felonyConviction: 'No',
    misdemeanorConviction: 'No',
    pendingCharges: 'No',
    deferredAdjudication: 'No',
    militaryCourtMartial: 'No',
    registryRequired: 'No',
    offenses: [],
    acknowledgment: true
  },
  drivingRecord: {
    validLicense: 'Yes',
    licenseNumber: 'GA0000000',
    state: 'GA',
    cdl: 'No',
    movingViolations: '0',
    accidents: '0',
    duiHistory: 'None'
  },
  references: [
    { name: 'Jane Doe', relationship: 'Former Supervisor', company: 'Peachtree Compliance Services', phone: '(404) 555-0188', email: 'jane.doe@example.com', yearsKnown: '5' },
    { name: 'John Smith', relationship: 'Colleague', company: 'Peachtree Compliance Services', phone: '(404) 555-0177', email: 'john.smith@example.com', yearsKnown: '4' },
    { name: 'Maya Carter', relationship: 'Client Contact', company: 'Carter Advisory', phone: '(404) 555-0119', email: 'maya.carter@example.com', yearsKnown: '2' }
  ],
  backgroundAuthorization: {
    fullLegalName: 'Test Applicant QC',
    dateOfBirth: '1990-04-12',
    socialSecurityNumber: '000-00-0000',
    currentAddress: '123 Test Street, Atlanta, GA 30303',
    typedSignature: 'Test Applicant QC',
    signatureDate: '2026-06-15',
    printedName: 'Test Applicant QC'
  },
  signatures: {
    backgroundAuthorization: 'Test Applicant QC',
    standardsOfConduct: 'Test Applicant QC',
    applicantCertification: 'Test Applicant QC'
  },
  applicantCertification: { typedFullLegalName: 'Test Applicant QC', date: '2026-06-15' },
  account: { portalAccountCreated: true }
};

const uploads = {
  resume: [{ originalname: 'test-resume.pdf' }],
  degree: [{ originalname: 'test-degree.pdf' }]
};

payload.education.degrees.push(
  { school: 'Atlanta Technical College', degree: 'Certificate', field: 'Records Management', graduationYear: '2016' },
  { school: 'Mercer University', degree: 'Bachelor of Science (BS)', field: 'Public Safety', graduationYear: '2020' },
  { school: 'Kennesaw State University', degree: 'Certificate', field: 'Data Quality', graduationYear: '2021' },
  { school: 'Georgia State University', degree: 'Certificate', field: 'Compliance Review', graduationYear: '2022' }
);
payload.certifications.records.push(
  { group: 'Compliance', name: 'Internal Auditor', licenseNumber: 'IA-100', state: 'GA', expirationDate: '2027-01-31', status: 'Active' },
  { group: 'Compliance', name: 'Quality Management', licenseNumber: 'QM-101', state: 'GA', expirationDate: '2027-02-28', status: 'Active' },
  { group: 'Compliance', name: 'Records Specialist', licenseNumber: 'RS-102', state: 'GA', expirationDate: '2027-03-31', status: 'Active' },
  { group: 'Compliance', name: 'Case Review Lead', licenseNumber: 'CR-103', state: 'GA', expirationDate: '2027-04-30', status: 'Active' },
  { group: 'Compliance', name: 'Documentation Analyst', licenseNumber: 'DA-104', state: 'GA', expirationDate: '2027-05-31', status: 'Active' }
);
payload.languages.push(
  { language: 'French', proficiency: 'Conversational', skills: ['Read'], certification: '' },
  { language: 'Portuguese', proficiency: 'Conversational', skills: ['Speak'], certification: '' },
  { language: 'Arabic', proficiency: 'Basic', skills: ['Read'], certification: '' },
  { language: 'Haitian Creole', proficiency: 'Basic', skills: ['Speak'], certification: '' }
);
payload.employmentHistory.employers.push(
  { employer: 'Metro Records Group', title: 'Records Analyst', startDate: '2018-01-01', endDate: '2020-12-31', supervisor: 'Sam Lee', phone: '(404) 555-0120', reasonForLeaving: 'Contract ended', duties: 'Reviewed structured case records.' },
  { employer: 'Southern Audit Partners', title: 'Audit Associate', startDate: '2016-01-01', endDate: '2017-12-31', supervisor: 'Rina Patel', phone: '(404) 555-0121', reasonForLeaving: 'New role', duties: 'Prepared exception reports.' },
  { employer: 'Civic Data Services', title: 'Data Specialist', startDate: '2014-01-01', endDate: '2015-12-31', supervisor: 'Alex Green', phone: '(404) 555-0122', reasonForLeaving: 'Relocation', duties: 'Maintained intake logs.' },
  { employer: 'Alpha Staffing', title: 'Case Assistant', startDate: '2012-01-01', endDate: '2013-12-31', supervisor: 'Nora King', phone: '(404) 555-0123', reasonForLeaving: 'Career growth', duties: 'Supported file preparation.' },
  { employer: 'County Support Office', title: 'Clerk', startDate: '2010-01-01', endDate: '2011-12-31', supervisor: 'Evan Brooks', phone: '(404) 555-0124', reasonForLeaving: 'Promotion', duties: 'Filed public records.' }
);
payload.criminalHistory.offenses.push(
  { type: 'Other', offense: 'N/A', offenseDate: '2010-01-01', jurisdiction: 'N/A', court: 'N/A', disposition: 'Dismissed', sentence: 'N/A', status: 'Completed / Fully Discharged', context: 'PDF overflow fixture row.' },
  { type: 'Other', offense: 'N/A', offenseDate: '2011-01-01', jurisdiction: 'N/A', court: 'N/A', disposition: 'Dismissed', sentence: 'N/A', status: 'Completed / Fully Discharged', context: 'PDF overflow fixture row.' },
  { type: 'Other', offense: 'N/A', offenseDate: '2012-01-01', jurisdiction: 'N/A', court: 'N/A', disposition: 'Dismissed', sentence: 'N/A', status: 'Completed / Fully Discharged', context: 'PDF overflow fixture row.' },
  { type: 'Other', offense: 'N/A', offenseDate: '2013-01-01', jurisdiction: 'N/A', court: 'N/A', disposition: 'Dismissed', sentence: 'N/A', status: 'Completed / Fully Discharged', context: 'PDF overflow fixture row.' }
);
payload.references.push(
  { name: 'Reference Four', relationship: 'Peer', company: 'Alpha', phone: '(404) 555-0130', email: 'ref4@example.com', yearsKnown: '4' },
  { name: 'Reference Five', relationship: 'Peer', company: 'Alpha', phone: '(404) 555-0131', email: 'ref5@example.com', yearsKnown: '4' },
  { name: 'Reference Six', relationship: 'Peer', company: 'Alpha', phone: '(404) 555-0132', email: 'ref6@example.com', yearsKnown: '4' },
  { name: 'Reference Seven', relationship: 'Peer', company: 'Alpha', phone: '(404) 555-0133', email: 'ref7@example.com', yearsKnown: '4' },
  { name: 'Reference Eight', relationship: 'Peer', company: 'Alpha', phone: '(404) 555-0134', email: 'ref8@example.com', yearsKnown: '4' },
  { name: 'Reference Nine', relationship: 'Peer', company: 'Alpha', phone: '(404) 555-0135', email: 'ref9@example.com', yearsKnown: '4' }
);

const pdf = await buildApplicationPdf({
  payload,
  role: { title: 'Quality Control Specialist', department: 'Administration', location: 'Atlanta, GA', employmentType: 'Full-time' },
  confirmation: 'AD-2026-00000-ABC123',
  uploads
});

if (pdf.length < 1000) throw new Error(`Generated PDF is unexpectedly small (${pdf.length} bytes).`);

const outDir = path.join(root, 'output');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'sample-application.pdf');
fs.writeFileSync(outFile, pdf);
console.log(`Wrote ${outFile} (${pdf.length} bytes)`);
