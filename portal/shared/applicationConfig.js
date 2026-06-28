export const CERTIFICATION_GROUPS = {
  adminCerts: ['PMP', 'CAPM', 'Certified Administrative Professional (CAP)', 'Professional Administrative Certification of Excellence (PACE)', 'Six Sigma Yellow Belt', 'Six Sigma Green Belt', 'Six Sigma Black Belt', 'Notary Public', 'Microsoft 365 Certifications', 'Microsoft Office Specialist (MOS)', 'SHRM-CP', 'SHRM-SCP', 'PHR', 'SPHR'],
  qualityCerts: ['Certified Quality Auditor (CQA)', 'Certified Quality Improvement Associate (CQIA)', 'Certified Manager of Quality / Organizational Excellence (CMQ/OE)', 'Six Sigma Yellow Belt', 'Six Sigma Green Belt', 'Six Sigma Black Belt', 'Lean Six Sigma Certification', 'ISO 9001 Lead Auditor', 'Certified Compliance & Ethics Professional (CCEP)', 'Certified Internal Auditor (CIA)'],
  techCerts: ['Power BI Certification', 'Tableau Certification', 'Microsoft Certified: Data Analyst Associate', 'SQL Certification', 'SAS Certification', 'Google Data Analytics Certificate', 'CompTIA Data+', 'AWS Certified Cloud Practitioner', 'Microsoft Azure Fundamentals', 'Security+'],
  securityCerts: ['Industrial Security Professional (ISP)', 'Certified Protection Professional (CPP)', 'Physical Security Professional (PSP)', 'Professional Certified Investigator (PCI)', 'CompTIA Security+', 'FSO Training', 'DCSA Personnel Security Training', 'DCSA Insider Threat Training', 'Security Fundamentals Professional Certification (SFPC)', 'Special Program Security Certification (SPSC)'],
  trainingCerts: ['ATD Certified Professional in Talent Development (CPTD)', 'ATD Associate Professional in Talent Development (APTD)', 'Train the Trainer', 'Instructional Design Certification', 'Certified Professional in Training Management (CPTM)', 'Learning Management System Administration Certification', 'Adult Learning Certification'],
  socialWorkCerts: ['Licensed Social Worker (LSW)', 'Licensed Master Social Worker (LMSW)', 'Licensed Clinical Social Worker (LCSW)', 'Licensed Professional Counselor (LPC)', 'Licensed Marriage and Family Therapist (LMFT)', 'Certified Case Manager (CCM)', 'Human Services-Board Certified Practitioner (HS-BCP)', 'Mandated Reporter Training', 'Trauma-Informed Care Training', 'Child Welfare Certification'],
  intelCerts: ['SANS SEC487', 'IntelTechniques OSINT Certification', 'Certified Cyber Threat Intelligence Analyst', 'Crime and Intelligence Analysis Certificate', 'Certified Crime Analyst (CCA)', 'Certified Intelligence Analyst (IALEIA)', 'Open Source Intelligence Professional (OSIP)', 'GIAC Cyber Threat Intelligence (GCTI)', 'IACA Crime Analysis Certification'],
  fieldCerts: ['CPR', 'First Aid', 'AED Certification', 'FEMA IS-100', 'FEMA IS-200', 'FEMA IS-700', 'FEMA IS-800', 'NIMS Certification', 'Private Investigator License', 'Security Officer License', 'Process Server Certification', 'Defensive Driving Certification', 'De-escalation Training', 'Trauma-Informed Care Training', 'Mandated Reporter Training', 'Crisis Intervention Training (CIT)', 'Tactical Communications Training'],
  languageCerts: ['American Translators Association (ATA)', 'Court Interpreter Certification (State)', 'Federal Court Interpreter Certification', 'DLPT (Defense Language Proficiency Test)', 'Medical Interpreter Certification (CCHI/NBCMI)', 'Certified Healthcare Interpreter (CHI)', 'National Board Certified Medical Interpreter (NBCMI)', 'State Interpreter Certification', 'Language Proficiency Interview (LPI)', 'ACTFL Oral Proficiency Interview (OPI)']
};

export const LANGUAGES = [
  'Spanish',
  'American Sign Language (ASL)',
  'Arabic (Modern Standard)',
  'Chaldean',
  'Chinese - Cantonese (Simplified)',
  'Chinese - Cantonese (Traditional)',
  'Chinese - Mandarin (Simplified)',
  'Chinese - Mandarin (Traditional)',
  'Farsi',
  'French',
  'German',
  'Gujarati',
  'Haitian Creole',
  'Hindi',
  'Italian',
  "K'iche'",
  'Korean',
  'Polish',
  'Portuguese',
  'Punjabi',
  'Russian',
  'Sinhala',
  'Somali',
  'Tamil',
  'Tigrinya',
  'Urdu',
  'Vietnamese',
  'Other'
];

const baseUploads = {
  resume: 'required'
};

export const EXPERIENCE_ALTERNATIVE_MIN_YEARS = 10;

export const EDUCATION_REQUIREMENT_LABELS = {
  highSchool: 'High School Diploma or GED',
  associate: "Associate's Degree",
  bachelor: "Bachelor's Degree",
  master: "Master's Degree",
  doctorate: 'Doctoral or Professional Degree'
};

export function degreeRank(value) {
  const text = String(value || '').toLowerCase();
  if (!text) return -1;
  if (text.includes('doctor')) return 4;
  if (text.includes('master')) return 3;
  if (text.includes('bachelor')) return 2;
  if (text.includes('associate')) return 1;
  if (text.includes('high school') || text === 'ged' || text.includes('general educational development')) return 0;
  return -1;
}

export function degreeMeetsRequirement(value, requirement) {
  const rank = degreeRank(value);
  if (requirement === 'highSchool') return rank === 0;
  if (requirement === 'associate') return rank >= 1;
  if (requirement === 'bachelor') return rank >= 2;
  if (requirement === 'master') return rank >= 3;
  if (requirement === 'doctorate') return rank >= 4;
  return false;
}

function slug(title) {
  return title.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function role(title, department, location, employmentType, options = {}) {
  const drivingRequired = options.drivingRequired || false;
  return {
    slug: slug(title),
    title,
    department,
    location,
    employmentType,
    travel: drivingRequired ? ['Up to 25%', 'Up to 50%', 'Up to 75%', '100%'] : ['None'],
    drivingRequired,
    languageRole: options.languageRole || 'none',
    certs: options.certs || [],
    uploads: { ...baseUploads, ...(options.uploads || {}) },
    requiredEducation: options.requiredEducation || [],
    minimumRelevantExperienceYears: options.minimumRelevantExperienceYears || 0
  };
}

export const ROLE_CONFIGS = [
  role('Program Director', 'Admin', 'Atlanta, GA', 'Full Time', {
    languageRole: 'optional',
    certs: ['adminCerts'],
    uploads: { degree: 'required' },
    requiredEducation: ['bachelor'],
    minimumRelevantExperienceYears: 10
  }),
  role('Quality Control Manager', 'Admin', 'Atlanta, GA', 'Full Time', {
    certs: ['qualityCerts'],
    uploads: { degree: 'required', certifications: 'conditional' },
    requiredEducation: ['bachelor'],
    minimumRelevantExperienceYears: 5
  }),
  role('Quality Control Specialist', 'Admin', 'Atlanta, GA', 'Full Time', {
    certs: ['qualityCerts'],
    uploads: { degree: 'conditional' },
    requiredEducation: ['associate'],
    minimumRelevantExperienceYears: 2
  }),
  role('Data and Reporting Manager', 'Admin', 'Atlanta, GA', 'Full Time', {
    certs: ['techCerts'],
    uploads: { degree: 'required', certifications: 'conditional' },
    requiredEducation: ['bachelor'],
    minimumRelevantExperienceYears: 4
  }),
  role('Corporate Security Officer', 'Admin', 'Atlanta, GA', 'Full Time', {
    certs: ['securityCerts'],
    uploads: { degree: 'required', securityLicense: 'conditional', certifications: 'conditional' },
    requiredEducation: ['bachelor'],
    minimumRelevantExperienceYears: 7
  }),
  role('Security Administrator', 'Admin', 'Atlanta, GA', 'Full Time', {
    certs: ['securityCerts'],
    uploads: { degree: 'conditional', certifications: 'conditional' },
    requiredEducation: ['associate'],
    minimumRelevantExperienceYears: 3
  }),
  role('Administrative Manager', 'Admin', 'Atlanta, GA', 'Full Time', {
    certs: ['adminCerts'],
    uploads: { degree: 'required' },
    requiredEducation: ['bachelor'],
    minimumRelevantExperienceYears: 5
  }),
  role('Administrative Specialist', 'Admin', 'Atlanta, GA', 'Full Time', {
    certs: ['adminCerts'],
    minimumRelevantExperienceYears: 2
  }),
  role('Training Specialist', 'Admin', 'Atlanta, GA', 'Full Time', {
    certs: ['trainingCerts'],
    uploads: { degree: 'required', certifications: 'conditional' },
    requiredEducation: ['bachelor'],
    minimumRelevantExperienceYears: 3
  }),
  role('Welfare Liaison', 'Admin', 'Atlanta, GA', 'Full Time', {
    languageRole: 'optional',
    certs: ['socialWorkCerts'],
    uploads: { degree: 'required', socialWorkLicense: 'conditional' },
    requiredEducation: ['bachelor'],
    minimumRelevantExperienceYears: 3
  }),
  role('Watch Commander', 'ISD', 'Atlanta, GA', 'Full Time', {
    languageRole: 'optional',
    certs: ['intelCerts'],
    uploads: { degree: 'required', certifications: 'conditional' },
    requiredEducation: ['bachelor'],
    minimumRelevantExperienceYears: 8
  }),
  role('Watch Supervisor', 'ISD', 'Atlanta, GA', 'Full Time', {
    languageRole: 'optional',
    certs: ['intelCerts'],
    uploads: { degree: 'required', certifications: 'conditional' },
    requiredEducation: ['bachelor'],
    minimumRelevantExperienceYears: 5
  }),
  role('Senior All-Source Intelligence Analyst', 'ISD', 'Atlanta, GA', 'Full Time', {
    certs: ['intelCerts'],
    uploads: { degree: 'required', certifications: 'conditional' },
    requiredEducation: ['bachelor'],
    minimumRelevantExperienceYears: 5
  }),
  role('All-Source Intelligence Analyst', 'ISD', 'Atlanta, GA', 'Full Time', {
    certs: ['intelCerts'],
    uploads: { degree: 'required', certifications: 'conditional' },
    requiredEducation: ['bachelor'],
    minimumRelevantExperienceYears: 3
  }),
  role('OSINT Analyst', 'ISD', 'Atlanta, GA', 'Full Time', {
    languageRole: 'optional',
    certs: ['intelCerts'],
    uploads: { degree: 'required', certifications: 'conditional' },
    requiredEducation: ['bachelor'],
    minimumRelevantExperienceYears: 3
  }),
  role('Real-Time Operations Analyst', 'ISD', 'Atlanta, GA', 'Full Time', {
    certs: ['intelCerts'],
    uploads: { degree: 'conditional', certifications: 'conditional' },
    requiredEducation: ['associate'],
    minimumRelevantExperienceYears: 2
  }),
  role('Linguist Analyst', 'ISD', 'Atlanta, GA', 'Part Time', {
    languageRole: 'required',
    certs: ['languageCerts'],
    uploads: { languageCertifications: 'conditional' },
    minimumRelevantExperienceYears: 3
  }),
  role('Data Entry Specialist', 'ISD', 'Atlanta, GA', 'Full Time', {
    certs: ['techCerts'],
    uploads: { certifications: 'conditional' },
    requiredEducation: ['highSchool'],
    minimumRelevantExperienceYears: 2
  }),
  role('Field Operations Manager', 'Field Operations', 'Atlanta, GA', 'Full Time', {
    drivingRequired: true,
    languageRole: 'optional',
    certs: ['fieldCerts'],
    uploads: { driversLicense: 'required', degree: 'required', certifications: 'conditional' },
    requiredEducation: ['bachelor'],
    minimumRelevantExperienceYears: 8
  }),
  role('Operations Manager', 'Field Operations', 'Atlanta, GA', 'Full Time', {
    drivingRequired: true,
    languageRole: 'optional',
    certs: ['fieldCerts'],
    uploads: { driversLicense: 'required', degree: 'required', certifications: 'conditional' },
    requiredEducation: ['bachelor'],
    minimumRelevantExperienceYears: 5
  }),
  role('Case Manager', 'Field Operations', 'Nationwide', 'Contract / Full Time', {
    drivingRequired: true,
    languageRole: 'optional',
    certs: ['fieldCerts', 'socialWorkCerts'],
    uploads: { driversLicense: 'required', degree: 'required', socialWorkLicense: 'conditional', certifications: 'conditional' },
    requiredEducation: ['bachelor'],
    minimumRelevantExperienceYears: 5
  }),
  role('Field Interpreter', 'Field Operations', 'Nationwide', 'Contract / Full Time', {
    drivingRequired: true,
    languageRole: 'required',
    certs: ['languageCerts'],
    uploads: { driversLicense: 'required', languageCertifications: 'conditional' },
    minimumRelevantExperienceYears: 2
  }),
  role('Case Management Specialist', 'Field Operations', 'Nationwide', 'Contract / Full Time', {
    drivingRequired: true,
    languageRole: 'optional',
    certs: ['fieldCerts'],
    uploads: { driversLicense: 'required', degree: 'conditional', certifications: 'conditional' },
    requiredEducation: ['associate'],
    minimumRelevantExperienceYears: 2
  })
];

export const ROLE_BY_SLUG = Object.fromEntries(ROLE_CONFIGS.map((item) => [item.slug, item]));

export const APPLICATION_STATUS = ['New', 'Under Review', 'Interview Scheduled', 'Offer Extended', 'Hired', 'Rejected'];

export const SECTION_TITLES = [
  'Position Information',
  'Personal Information',
  'Work Authorization & Eligibility',
  'Availability',
  'Military Service',
  'Education',
  'Professional Licenses & Certifications',
  'Employment History',
  'Government Contract Eligibility',
  'Criminal History Questionnaire',
  'Driving Record',
  'Professional References',
  'Background Investigation Authorization',
  'Standards of Conduct',
  'Application Review',
  'Applicant Certification'
];

export const APPLICATION_TOTAL_SECTIONS = SECTION_TITLES.length;

export const UPLOAD_LABELS = {
  resume: 'Resume',
  educationExperienceNarrative: 'Education Alternative Experience Narrative',
  driversLicense: "Driver's License",
  degree: 'Degree / Transcript',
  dd214: 'Military Documentation',
  certifications: 'Certifications selected in Section 7',
  securityLicense: 'Security License',
  socialWorkLicense: 'Social Work License',
  languageCertifications: 'Language Certifications'
};

function field(key, label, type = 'text', options = [], required = false, help = '') {
  return { key, label, type, options, required, help };
}

export const APPLICATION_SECTION_CONFIGS = [
  {
    id: 'position-information',
    title: 'Position Information',
    intro: 'Role details are prefilled from the selected job. Applicant provides desired start, pay, and referral source.',
    body: '',
    fields: [
      field('positionInformation.roleTitle', 'Position Applying For', 'readonly'),
      field('positionInformation.department', 'Department', 'readonly'),
      field('positionInformation.location', 'Location', 'readonly'),
      field('positionInformation.employmentType', 'Employment Type', 'readonly'),
      field('positionInformation.desiredStartDate', 'Desired Start Date', 'date', [], true),
      field('positionInformation.desiredPay', 'Desired Salary or Hourly Rate', 'text', [], true),
      field('positionInformation.heardAboutUs', 'How did you hear about us?', 'select', ['Alpha Recovery website', 'Referral', 'LinkedIn', 'Indeed', 'Recruiter', 'Other'])
    ]
  },
  {
    id: 'personal-information',
    title: 'Personal Information',
    intro: 'Applicant profile information is used for identity and contact fields.',
    body: 'Name, email, and phone come from the applicant portal profile. The applicant can edit address and SSN last four inside the application.',
    fields: [
      field('personalInformation.fullName', 'Full Legal Name', 'readonly', [], true),
      field('personalInformation.email', 'Email', 'readonly', [], true),
      field('personalInformation.phone', 'Phone', 'readonly', [], true),
      field('personalInformation.ssnLast4', 'Last 4 of SSN', 'text', [], true),
      field('personalInformation.address', 'Street Address'),
      field('personalInformation.city', 'City'),
      field('personalInformation.state', 'State'),
      field('personalInformation.zip', 'ZIP')
    ]
  },
  {
    id: 'work-authorization',
    title: 'Work Authorization & Eligibility',
    intro: 'Confirm United States work eligibility, sponsorship needs, and age requirement.',
    body: '',
    fields: [
      field('workAuthorization.authorized', 'Authorized to work in the United States?', 'yes-no', [], true),
      field('workAuthorization.sponsorship', 'Will you require sponsorship?', 'yes-no', [], true),
      field('workAuthorization.age18', 'Are you at least 18 years of age?', 'yes-no', [], true),
      field('workAuthorization.proof', 'Eligibility Notes', 'textarea')
    ]
  },
  {
    id: 'availability',
    title: 'Availability',
    intro: 'Collect travel, driving availability, transportation, insurance, and schedule notes.',
    body: '',
    fields: [
      field('availability.travelAvailability', 'Travel Availability', 'select', ['None', 'Up to 25%', 'Up to 50%', 'Up to 75%', '100%']),
      field('availability.reliableTransportation', 'Reliable Transportation', 'yes-no'),
      field('availability.validDriversLicense', "Valid Driver's License", 'yes-no'),
      field('availability.vehicleInsurance', 'Vehicle Insurance', 'yes-no'),
      field('availability.scheduleNotes', 'Schedule Notes', 'textarea')
    ]
  },
  {
    id: 'military-service',
    title: 'Military Service',
    intro: 'Capture military service history and supporting documentation when applicable.',
    body: '',
    fields: [
      field('militaryService.served', 'Have you served in the U.S. Armed Forces?', 'yes-no', [], true),
      field('militaryService.branch', 'Branch', 'select', ['Army', 'Marine Corps', 'Navy', 'Air Force', 'Space Force', 'Coast Guard', 'National Guard', 'Air National Guard', 'Reserves', 'Other']),
      field('militaryService.branchOther', 'Other Branch'),
      field('militaryService.dischargeType', 'Status / Discharge Type', 'select', ['Honorable', 'General Under Honorable Conditions', 'Other Than Honorable', 'Bad Conduct', 'Dishonorable', 'Entry-Level Separation', 'Medical Separation', 'Administrative Separation', 'Still Serving', 'Not Applicable', 'Other']),
      field('militaryService.dischargeOther', 'Explain Other Discharge Type', 'textarea'),
      field('militaryService.disabledVeteran', 'Disabled Veteran Status', 'yes-no')
    ]
  },
  {
    id: 'education',
    title: 'Education',
    intro: 'Collect education history, degree requirements, and education alternative uploads.',
    body: '',
    fields: [
      field('education.highestLevel', 'Highest Education Level', 'select', []),
      field('education.useExperienceAlternative', 'Use 10+ years of relevant experience as an alternative', 'checkbox'),
      field('education.degrees.school', 'School'),
      field('education.degrees.degree', 'Degree', 'select'),
      field('education.degrees.field', 'Field'),
      field('education.degrees.graduationYear', 'Graduation Date', 'date')
    ]
  },
  {
    id: 'licenses-certifications',
    title: 'Professional Licenses & Certifications',
    intro: 'Collect resume, selected certifications, certification details, and language capabilities.',
    body: '',
    fields: [
      field('certifications.selected', 'Certification Selection', 'checkbox-group'),
      field('certifications.records.name', 'License/Certification Name'),
      field('certifications.records.licenseNumber', 'License Number'),
      field('certifications.records.state', 'State'),
      field('certifications.records.expirationDate', 'Expiration Date', 'date'),
      field('certifications.records.status', 'Current Status'),
      field('languages.language', 'Language', 'select'),
      field('languages.proficiency', 'Proficiency', 'select', ['Native', 'Fluent', 'Professional', 'Conversational', 'Basic']),
      field('languages.skills', 'Language Skills', 'checkbox-group', ['Speak', 'Read', 'Write', 'Interpret', 'Translate']),
      field('languages.certification', 'Certification')
    ]
  },
  {
    id: 'employment-history',
    title: 'Employment History',
    intro: 'Collect relevant work history and calculate documented experience.',
    body: '',
    fields: [
      field('employmentHistory.yearsRelevantExperience', 'Calculated Relevant Experience', 'readonly'),
      field('employmentHistory.summary', 'Experience Summary', 'textarea'),
      field('employmentHistory.employers.employer', 'Employer'),
      field('employmentHistory.employers.title', 'Title'),
      field('employmentHistory.employers.startDate', 'Start Date', 'date'),
      field('employmentHistory.employers.endDate', 'End Date', 'date'),
      field('employmentHistory.employers.supervisor', 'Supervisor'),
      field('employmentHistory.employers.phone', 'Phone'),
      field('employmentHistory.employers.reasonForLeaving', 'Reason for Leaving'),
      field('employmentHistory.employers.duties', 'Duties', 'textarea')
    ]
  },
  {
    id: 'government-eligibility',
    title: 'Government Contract Eligibility',
    intro: 'Collect prior government contract, clearance, exclusion, and eligibility notes.',
    body: '',
    fields: [
      field('governmentEligibility.priorGovernmentContractWork', 'Prior Government Contract Work', 'yes-no'),
      field('governmentEligibility.agency', 'Agency / Contract'),
      field('governmentEligibility.clearanceHeld', 'Clearance Held'),
      field('governmentEligibility.debarred', 'Debarred or excluded from federal contracting?', 'yes-no'),
      field('governmentEligibility.notes', 'Notes', 'textarea')
    ]
  },
  {
    id: 'criminal-history',
    title: 'Criminal History Questionnaire',
    intro: 'Collect fair-chance criminal history disclosures and offense details when needed.',
    body: 'A criminal record does not automatically bar consideration. Disclosed records are evaluated individually.',
    fields: [
      field('criminalHistory.felonyConviction', 'Felony conviction question', 'yes-no', [], true),
      field('criminalHistory.misdemeanorConviction', 'Misdemeanor conviction question', 'yes-no', [], true),
      field('criminalHistory.pendingCharges', 'Pending charges question', 'yes-no', [], true),
      field('criminalHistory.deferredAdjudication', 'Deferred adjudication question', 'yes-no', [], true),
      field('criminalHistory.militaryCourtMartial', 'Military court-martial question', 'yes-no', [], true),
      field('criminalHistory.registryRequired', 'Registry question', 'yes-no', [], true),
      field('criminalHistory.offenses.offense', 'Charge / Offense'),
      field('criminalHistory.offenses.disposition', 'Disposition', 'select'),
      field('criminalHistory.acknowledgment', 'Criminal History Certification', 'checkbox', [], true)
    ]
  },
  {
    id: 'driving-record',
    title: 'Driving Record',
    intro: 'Collect driver eligibility details for roles requiring driving.',
    body: '',
    fields: [
      field('drivingRecord.validLicense', "Valid Driver's License?", 'yes-no', [], true),
      field('drivingRecord.licenseNumber', 'License Number', 'text', [], true),
      field('drivingRecord.state', 'State', 'text', [], true),
      field('drivingRecord.cdl', 'CDL?', 'yes-no'),
      field('drivingRecord.movingViolations', 'Moving Violations in Last 5 Years', 'number'),
      field('drivingRecord.accidents', 'Accidents in Last 5 Years', 'number'),
      field('drivingRecord.duiHistory', 'DUI History', 'textarea')
    ]
  },
  {
    id: 'professional-references',
    title: 'Professional References',
    intro: 'Collect at least three professional references.',
    body: '',
    fields: [
      field('references.name', 'Name'),
      field('references.relationship', 'Relationship'),
      field('references.company', 'Company'),
      field('references.phone', 'Phone'),
      field('references.email', 'Email', 'email'),
      field('references.yearsKnown', 'Years Known')
    ]
  },
  {
    id: 'background-authorization',
    title: 'Background Investigation Authorization',
    intro: 'Collect authorization information and consent for background investigation.',
    body: 'Controls the applicant information, authorization, federal background investigation, residency, disclosure, accuracy, no-guarantee, and signature copy shown on this page.',
    fields: [
      field('backgroundAuthorization.fullLegalName', 'Full Legal Name', 'text', [], true),
      field('backgroundAuthorization.dateOfBirth', 'Date of Birth', 'date', [], true),
      field('backgroundAuthorization.socialSecurityNumber', 'Social Security Number', 'text', [], true),
      field('backgroundAuthorization.currentAddress', 'Current Address', 'text', [], true),
      field('backgroundAuthorization.positionAppliedFor', 'Position Applied For', 'readonly'),
      field('backgroundAuthorization.typedSignature', 'Typed Signature', 'text', [], true),
      field('backgroundAuthorization.signatureDate', 'Date', 'date', [], true),
      field('backgroundAuthorization.printedName', 'Printed Name', 'text', [], true)
    ]
  },
  {
    id: 'standards-of-conduct',
    title: 'Standards of Conduct',
    intro: 'Collect applicant acknowledgment of professional standards.',
    body: 'Controls the professional standards and signature copy shown on this page.',
    fields: [
      field('signatures.standardsOfConduct', 'Typed Full Legal Name', 'text', [], true)
    ]
  },
  {
    id: 'application-review',
    title: 'Application Review',
    intro: 'Applicant reviews each completed section before final certification.',
    body: '',
    fields: [
      field('review.sections', 'Review Cards', 'review')
    ]
  },
  {
    id: 'applicant-certification',
    title: 'Applicant Certification',
    intro: 'Collect final certification of accuracy and typed applicant signature.',
    body: 'Controls the final certification copy shown before submission.',
    fields: [
      field('applicantCertification.typedFullLegalName', 'Typed Full Legal Name', 'text', [], true),
      field('applicantCertification.date', 'Date', 'date', [], true)
    ]
  }
];
