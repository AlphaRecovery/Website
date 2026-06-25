import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../auth/AuthContext.jsx';
import {
  APPLICATION_TOTAL_SECTIONS,
  CERTIFICATION_GROUPS,
  degreeMeetsRequirement,
  EDUCATION_REQUIREMENT_LABELS,
  EXPERIENCE_ALTERNATIVE_MIN_YEARS,
  LANGUAGES,
  SECTION_TITLES,
  UPLOAD_LABELS
} from '../../../shared/applicationConfig.js';

const emptyEmployer = { employer: '', title: '', startDate: '', endDate: '', supervisor: '', phone: '', reasonForLeaving: '', duties: '' };
const emptyReference = { name: '', relationship: '', company: '', phone: '', email: '', yearsKnown: '' };
const emptyLanguage = { language: 'Spanish', proficiency: 'Professional', skills: [], certification: '' };
const emptyCertification = { group: '', name: '', licenseNumber: '', state: '', expirationDate: '', status: '' };
const emptyOffense = { type: '', offense: '', offenseDate: '', jurisdiction: '', court: '', disposition: '', sentence: '', status: '', context: '' };
const emptyDegree = { school: '', degree: '', field: '', graduationYear: '' };
const DEFAULT_UPLOAD_LIMITS = {
  maxFileBytes: 10 * 1024 * 1024,
  maxRequestBytes: 18 * 1024 * 1024,
  maxFiles: 20
};
const militaryBranches = ['Army', 'Marine Corps', 'Navy', 'Air Force', 'Space Force', 'Coast Guard', 'National Guard', 'Air National Guard', 'Reserves', 'Other'];
const dischargeTypes = ['Honorable', 'General Under Honorable Conditions', 'Other Than Honorable', 'Bad Conduct', 'Dishonorable', 'Entry-Level Separation', 'Medical Separation', 'Administrative Separation', 'Still Serving', 'Not Applicable', 'Other'];
const degreeTypes = ['High School Diploma', 'GED', 'Certificate', 'Vocational Certificate', 'Trade Certificate', 'Associate of Arts (AA)', 'Associate of Science (AS)', 'Associate of Applied Science (AAS)', 'Bachelor of Arts (BA)', 'Bachelor of Science (BS)', 'Bachelor of Business Administration (BBA)', 'Bachelor of Social Work (BSW)', 'Master of Arts (MA)', 'Master of Science (MS)', 'Master of Business Administration (MBA)', 'Master of Public Administration (MPA)', 'Master of Social Work (MSW)', 'Juris Doctor (JD)', 'Doctor of Philosophy (PhD)', 'Doctorate / Professional Degree', 'Other'];

const CRIMINAL_SCREENING = [
  ['felonyConviction', 'Have you ever been convicted of, or pleaded guilty or no contest (nolo contendere) to, a felony?'],
  ['misdemeanorConviction', 'Have you ever been convicted of, or pleaded guilty or no contest to, a misdemeanor (excluding minor traffic violations)?'],
  ['pendingCharges', 'Do you currently have any criminal charges pending or unresolved against you in any jurisdiction?'],
  ['deferredAdjudication', 'Have you ever received deferred adjudication, diversion, a withheld or suspended judgment, or probation before judgment for a criminal offense?'],
  ['militaryCourtMartial', 'Have you ever been convicted by a military court-martial or received non-judicial punishment (e.g., Article 15)?'],
  ['registryRequired', 'Are you currently required to register on any state or federal offender registry?']
];

const DISPLAY_TOTAL_SECTIONS = APPLICATION_TOTAL_SECTIONS;

function visibleSectionNumber(sectionNumber) {
  return sectionNumber;
}

function initialPayload(role, user) {
  return {
    positionInformation: {
      roleTitle: role.title,
      department: role.department,
      location: role.location,
      employmentType: role.employmentType,
      desiredStartDate: '',
      desiredPay: '',
      heardAboutUs: ''
    },
    personalInformation: {
      fullName: user?.full_name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      ssnLast4: '',
      address: '',
      city: '',
      state: user?.location || '',
      zip: ''
    },
    account: { portalAccountCreated: true },
    workAuthorization: { authorized: '', sponsorship: '', age18: '', proof: '' },
    availability: { travelAvailability: role.drivingRequired ? '' : 'None', reliableTransportation: '', validDriversLicense: '', vehicleInsurance: '', scheduleNotes: '' },
    militaryService: { served: '', branch: '', branchOther: '', dischargeType: '', dischargeOther: '', disabledVeteran: '' },
    education: { highestLevel: '', useExperienceAlternative: false, degrees: [{ ...emptyDegree }] },
    certifications: { selected: [], records: [] },
    languages: [],
    employmentHistory: { yearsRelevantExperience: '', summary: '', employers: [{ ...emptyEmployer }] },
    governmentEligibility: { priorGovernmentContractWork: '', agency: '', clearanceHeld: '', debarred: '', notes: '' },
    criminalHistory: { felonyConviction: '', misdemeanorConviction: '', pendingCharges: '', deferredAdjudication: '', militaryCourtMartial: '', registryRequired: '', offenses: [], acknowledgment: false },
    drivingRecord: { validLicense: '', licenseNumber: '', state: '', cdl: '', movingViolations: '', accidents: '', duiHistory: '' },
    references: [{ ...emptyReference }, { ...emptyReference }, { ...emptyReference }],
    backgroundAuthorization: {
      fullLegalName: '',
      dateOfBirth: '',
      socialSecurityNumber: '',
      currentAddress: '',
      positionAppliedFor: role.title,
      typedSignature: '',
      signatureDate: '',
      printedName: ''
    },
    standardsOfConduct: { consent: false },
    applicantCertification: { typedFullLegalName: '', date: '' },
    uploads: {},
    signatures: { backgroundAuthorization: '', standardsOfConduct: '', applicantCertification: '' }
  };
}

function mergePayload(base, current = {}) {
  return {
    ...base,
    ...current,
    positionInformation: { ...base.positionInformation, ...current.positionInformation },
    personalInformation: { ...base.personalInformation, ...current.personalInformation },
    account: { ...base.account, ...current.account, portalAccountCreated: true },
    workAuthorization: { ...base.workAuthorization, ...current.workAuthorization },
    availability: { ...base.availability, ...current.availability },
    militaryService: { ...base.militaryService, ...current.militaryService },
    education: {
      ...base.education,
      ...current.education,
      degrees: Array.isArray(current.education?.degrees) && current.education.degrees.length ? current.education.degrees : base.education.degrees
    },
    certifications: { ...base.certifications, ...current.certifications, selected: current.certifications?.selected || base.certifications.selected, records: current.certifications?.records || base.certifications.records },
    languages: Array.isArray(current.languages) ? current.languages : base.languages,
    employmentHistory: {
      ...base.employmentHistory,
      ...current.employmentHistory,
      employers: Array.isArray(current.employmentHistory?.employers) && current.employmentHistory.employers.length ? current.employmentHistory.employers : base.employmentHistory.employers
    },
    governmentEligibility: { ...base.governmentEligibility, ...current.governmentEligibility },
    criminalHistory: { ...base.criminalHistory, ...current.criminalHistory, offenses: current.criminalHistory?.offenses || base.criminalHistory.offenses },
    drivingRecord: { ...base.drivingRecord, ...current.drivingRecord },
    references: Array.isArray(current.references) && current.references.length ? current.references : base.references,
    backgroundAuthorization: { ...base.backgroundAuthorization, ...current.backgroundAuthorization, positionAppliedFor: base.backgroundAuthorization.positionAppliedFor },
    standardsOfConduct: { ...base.standardsOfConduct, ...current.standardsOfConduct },
    applicantCertification: { ...base.applicantCertification, ...current.applicantCertification },
    uploads: { ...base.uploads, ...current.uploads },
    signatures: { ...base.signatures, ...current.signatures }
  };
}

function Field({ label, children }) {
  return <label>{label}{children}</label>;
}

function TextInput({ value, onChange, type = 'text', required = false, readOnly = false, placeholder = '' }) {
  return <input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} required={required} readOnly={readOnly} placeholder={placeholder} />;
}

function SelectInput({ value, onChange, options, required = false }) {
  return (
    <select value={value || ''} onChange={(event) => onChange(event.target.value)} required={required}>
      <option value="">Select</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function yesNo() {
  return ['Yes', 'No'];
}

function updateList(list, index, patch) {
  return list.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item);
}

function fileLabel(status) {
  if (status === 'required') return 'Required';
  if (status === 'conditional') return 'Conditional';
  return 'Optional';
}

function formatMegabytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function totalSelectedUploadBytes(files = {}) {
  return Object.values(files)
    .flat()
    .reduce((total, file) => total + Number(file?.size || 0), 0);
}

function completedRows(rows, keys) {
  return rows.filter((row) => keys.every((key) => String(row?.[key] || '').trim()));
}

function calculateEmploymentYears(employers) {
  let totalDays = 0;
  for (const employer of employers || []) {
    if (!employer.employer || !employer.title || !employer.startDate) continue;
    const start = new Date(employer.startDate);
    const end = employer.endDate ? new Date(employer.endDate) : new Date();
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) continue;
    totalDays += Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
  }
  return Math.round((totalDays / 365.25) * 10) / 10;
}

function usesExperienceEducationAlternative(education = {}) {
  return education.useExperienceAlternative === true;
}

function requiredEducationErrors(role, education = {}) {
  const errors = [];
  const requirements = role.requiredEducation || [];
  if (requirements.length && usesExperienceEducationAlternative(education)) return errors;
  const completed = completedRows(education.degrees || [], ['school', 'degree', 'graduationYear']);

  if (requirements.length && !completed.length) {
    errors.push('Enter the required education history for this position before continuing.');
    return errors;
  }

  for (const requirement of requirements) {
    if (!completed.some((degree) => degreeMeetsRequirement(degree.degree, requirement))) {
      errors.push(`${EDUCATION_REQUIREMENT_LABELS[requirement] || requirement} is required for this position.`);
    }
  }

  return errors;
}

function getSectionUploads(sectionNumber, role, payload) {
  const uploads = [];

  if (sectionNumber === 5 && payload.militaryService.served === 'Yes') {
    uploads.push({
      field: 'dd214',
      status: payload.militaryService.dischargeType === 'Still Serving' ? 'conditional' : 'required'
    });
  }

  if (sectionNumber === 6 && usesExperienceEducationAlternative(payload.education)) {
    uploads.push({ field: 'educationExperienceNarrative', status: 'required' });
  } else if (sectionNumber === 6 && role.uploads.degree) {
    uploads.push({ field: 'degree', status: role.uploads.degree });
  }

  if (sectionNumber === 7) {
    uploads.push({ field: 'resume', status: role.uploads.resume || 'required' });
    ['certifications', 'securityLicense', 'socialWorkLicense', 'languageCertifications'].forEach((field) => {
      if (role.uploads[field]) uploads.push({ field, status: role.uploads[field] });
    });
  }

  if (sectionNumber === 11 && role.uploads.driversLicense) {
    uploads.push({ field: 'driversLicense', status: role.uploads.driversLicense });
  }

  return uploads;
}

function requiredUploadErrors(sectionNumber, role, payload, files) {
  return getSectionUploads(sectionNumber, role, payload)
    .filter((item) => item.status === 'required' && !files[item.field]?.length)
    .map((item) => `${UPLOAD_LABELS[item.field] || item.field} upload is required.`);
}

function summarizeSection(sectionNumber, role, payload, files) {
  const personal = payload.personalInformation || {};
  const education = payload.education || {};
  const employers = payload.employmentHistory?.employers || [];
  const years = calculateEmploymentYears(employers);
  const uploads = getSectionUploads(sectionNumber, role, payload);

  if (sectionNumber === 1) return [payload.positionInformation.roleTitle, payload.positionInformation.desiredStartDate ? `Start ${payload.positionInformation.desiredStartDate}` : 'Start date missing'];
  if (sectionNumber === 2) return [personal.fullName || 'Full legal name missing', personal.email || 'Email missing'];
  if (sectionNumber === 3) return [payload.workAuthorization.authorized ? `Authorized: ${payload.workAuthorization.authorized}` : 'Authorization unanswered'];
  if (sectionNumber === 4) return [role.drivingRequired ? `Travel availability: ${payload.availability.travelAvailability || 'Missing'}` : 'Travel not required'];
  if (sectionNumber === 5) return [payload.militaryService.served ? `Military service: ${payload.militaryService.served}` : 'Military service unanswered', ...uploads.filter((item) => files[item.field]?.length).map((item) => `${UPLOAD_LABELS[item.field]} uploaded`)];
  if (sectionNumber === 6) {
    return [
      education.highestLevel || 'Highest education level missing',
      usesExperienceEducationAlternative(education) ? `Experience alternative requested - narrative ${files.educationExperienceNarrative?.length ? 'uploaded' : 'missing'}` : `${completedRows(education.degrees || [], ['school', 'degree', 'graduationYear']).length} education record(s)`
    ];
  }
  if (sectionNumber === 7) return [`Resume ${files.resume?.length ? 'uploaded' : 'missing'}`, `${(payload.certifications.selected || []).length} certification(s) selected`, `${(payload.languages || []).length} language profile(s)`];
  if (sectionNumber === 8) return [`${years} year(s) documented`, `${completedRows(employers, ['employer', 'title', 'startDate']).length} employment record(s)`];
  if (sectionNumber === 9) return [payload.governmentEligibility.priorGovernmentContractWork ? `Prior contract work: ${payload.governmentEligibility.priorGovernmentContractWork}` : 'Government eligibility unanswered'];
  if (sectionNumber === 10) return [payload.criminalHistory.acknowledgment ? 'Criminal history certified' : 'Certification missing'];
  if (sectionNumber === 11) return [payload.drivingRecord.validLicense ? `Valid license: ${payload.drivingRecord.validLicense}` : 'Driving record incomplete', files.driversLicense?.length ? "Driver's license uploaded" : "Driver's license upload missing"];
  if (sectionNumber === 12) return [`${completedRows(payload.references || [], ['name', 'phone']).length} reference(s) entered`];
  if (sectionNumber === 13) return [payload.backgroundAuthorization.typedSignature ? 'Authorization signed' : 'Authorization incomplete'];
  if (sectionNumber === 14) return [payload.signatures.standardsOfConduct ? 'Standards acknowledged' : 'Standards signature missing'];
  if (sectionNumber === 15) return ['Review your entire application before final certification.'];
  return [];
}

export default function ApplicationForm() {
  const { roleSlug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [role, setRole] = useState(null);
  const [payload, setPayload] = useState(null);
  const [section, setSection] = useState(1);
  const [files, setFiles] = useState({});
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submittedApplication, setSubmittedApplication] = useState(null);
  const [uploadLimits, setUploadLimits] = useState(DEFAULT_UPLOAD_LIMITS);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const data = await api(`/api/application/roles/${roleSlug}`);
        if (!mounted) return;
        if (data.uploadLimits) setUploadLimits(data.uploadLimits);
        const draftData = await api(`/api/application/draft?roleSlug=${encodeURIComponent(roleSlug)}`);
        if (draftData.submitted) setSubmittedApplication(draftData.submitted);
        const basePayload = initialPayload(data.role, user);
        const nextPayload = mergePayload(basePayload, draftData.draft?.payload || {});
        setRole(data.role);
        setPayload({
          ...nextPayload,
          personalInformation: {
            ...nextPayload.personalInformation,
            fullName: user.full_name || nextPayload.personalInformation?.fullName || '',
            email: user.email || nextPayload.personalInformation?.email || '',
            phone: user.phone || nextPayload.personalInformation?.phone || '',
            state: nextPayload.personalInformation?.state || user.location || ''
          },
          positionInformation: {
            ...nextPayload.positionInformation,
            roleTitle: data.role.title,
            department: data.role.department,
            location: data.role.location,
            employmentType: data.role.employmentType
          },
          backgroundAuthorization: {
            ...nextPayload.backgroundAuthorization,
            positionAppliedFor: data.role.title
          },
          account: { portalAccountCreated: true }
        });
        if (draftData.draft?.section) setSection(draftData.draft.section);
        if (draftData.draft) setSaved('Draft restored from My Application.');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [roleSlug, user]);

  const certOptions = useMemo(() => {
    if (!role) return [];
    return role.certs.flatMap((group) => (CERTIFICATION_GROUPS[group] || []).map((name) => ({ group, name })));
  }, [role]);

  function patch(key, value) {
    setPayload((current) => ({ ...current, [key]: { ...current[key], ...value } }));
  }

  function setTop(key, value) {
    setPayload((current) => ({ ...current, [key]: value }));
  }

  function setBackgroundAuthorization(patchValue) {
    setPayload((current) => {
      const next = { ...current.backgroundAuthorization, ...patchValue };
      return {
        ...current,
        backgroundAuthorization: next,
        signatures: { ...current.signatures, backgroundAuthorization: next.typedSignature || current.signatures.backgroundAuthorization }
      };
    });
  }

  function setApplicantCertification(patchValue) {
    setPayload((current) => {
      const next = { ...current.applicantCertification, ...patchValue };
      return {
        ...current,
        applicantCertification: next,
        signatures: { ...current.signatures, applicantCertification: next.typedFullLegalName || current.signatures.applicantCertification }
      };
    });
  }

  function getSectionErrors(targetSection) {
    const errors = [];
    if (!isSectionApplicable(targetSection)) return errors;

    if (targetSection === 1) {
      if (!payload.positionInformation.desiredStartDate) errors.push('Desired start date is required.');
      if (!payload.positionInformation.desiredPay) errors.push('Desired salary or hourly rate is required.');
    }

    if (targetSection === 2) {
      if (!payload.personalInformation.fullName) errors.push('Full legal name is required.');
      if (!payload.personalInformation.email) errors.push('Email is required.');
      if (!payload.personalInformation.phone) errors.push('Phone is required.');
      if (!/^\d{4}$/.test(payload.personalInformation.ssnLast4 || '')) errors.push('Last 4 of SSN is required.');
    }

    if (targetSection === 3) {
      if (!payload.workAuthorization.authorized || !payload.workAuthorization.sponsorship || !payload.workAuthorization.age18) {
        errors.push('Work authorization questions are required.');
      }
    }

    if (targetSection === 4 && role.drivingRequired) {
      if (!payload.availability.travelAvailability || !payload.availability.reliableTransportation || !payload.availability.validDriversLicense || !payload.availability.vehicleInsurance) {
        errors.push('Travel and driving eligibility questions are required.');
      }
    }

    if (targetSection === 5) {
      if (!payload.militaryService.served) errors.push('Indicate whether you have military service.');
      if (payload.militaryService.served === 'Yes') {
        if (!payload.militaryService.branch) errors.push('Military branch is required.');
        if (payload.militaryService.branch === 'Other' && !payload.militaryService.branchOther) errors.push('Other military branch is required.');
        if (!payload.militaryService.dischargeType) errors.push('Military status or discharge type is required.');
        if (payload.militaryService.dischargeType === 'Other' && !payload.militaryService.dischargeOther) errors.push('Explain the other discharge type in 1000 characters or less.');
        if (payload.militaryService.dischargeOther?.length > 1000) errors.push('Military discharge explanation must be 1000 characters or less.');
        if (!payload.militaryService.disabledVeteran) errors.push('Disabled veteran status is required.');
      }
      errors.push(...requiredUploadErrors(5, role, payload, files));
    }

    if (targetSection === 6) {
      if (!payload.education.highestLevel) errors.push('Highest education level is required.');
      errors.push(...requiredEducationErrors(role, payload.education));
      errors.push(...requiredUploadErrors(6, role, payload, files));
    }

    if (targetSection === 7) {
      if (role.languageRole === 'required' && !payload.languages.length) errors.push('At least one language is required.');
      errors.push(...requiredUploadErrors(7, role, payload, files));
    }

    if (targetSection === 8) {
      const employers = payload.employmentHistory.employers || [];
      const completedEmployers = completedRows(employers, ['employer', 'title', 'startDate']);
      const documentedYears = calculateEmploymentYears(employers);
      if (!completedEmployers.length) errors.push('Enter at least one employer with a start date.');
      if (usesExperienceEducationAlternative(payload.education) && documentedYears < EXPERIENCE_ALTERNATIVE_MIN_YEARS) {
        errors.push(`Education alternative requires at least ${EXPERIENCE_ALTERNATIVE_MIN_YEARS} years of documented relevant experience.`);
      }
      if (role.minimumRelevantExperienceYears > 0 && documentedYears < role.minimumRelevantExperienceYears) {
        errors.push(`Employment history must document at least ${role.minimumRelevantExperienceYears} years of relevant experience for this position.`);
      }
    }

    if (targetSection === 10) {
      const criminal = payload.criminalHistory;
      if (CRIMINAL_SCREENING.some(([key]) => !criminal[key])) errors.push('Answer every Criminal History question.');
      const anyYes = CRIMINAL_SCREENING.some(([key]) => criminal[key] === 'Yes');
      const offenses = criminal.offenses || [];
      if (anyYes && !offenses.some((item) => item.offense && item.disposition)) errors.push('Provide offense details (charge and disposition) for each "Yes" answer.');
      if (!criminal.acknowledgment) errors.push('You must acknowledge the Criminal History certification.');
    }

    if (targetSection === 11 && role.drivingRequired) {
      if (!payload.drivingRecord.validLicense || !payload.drivingRecord.licenseNumber || !payload.drivingRecord.state) {
        errors.push('Driving record is required.');
      }
      errors.push(...requiredUploadErrors(11, role, payload, files));
    }

    if (targetSection === 12) {
      if (completedRows(payload.references || [], ['name', 'phone']).length < 3) errors.push('Enter at least 3 references.');
    }

    if (targetSection === 13) {
      const data = payload.backgroundAuthorization;
      if (!data.fullLegalName) errors.push('Background authorization full legal name is required.');
      if (!data.dateOfBirth) errors.push('Background authorization date of birth is required.');
      if (!/^\d{3}-?\d{2}-?\d{4}$/.test(data.socialSecurityNumber || '')) errors.push('Background authorization Social Security Number is required.');
      if (!data.currentAddress) errors.push('Background authorization current address is required.');
      if (!data.typedSignature) errors.push('Background authorization typed signature is required.');
      if (!data.signatureDate) errors.push('Background authorization date is required.');
      if (!data.printedName) errors.push('Background authorization printed name is required.');
    }

    if (targetSection === 14 && !payload.signatures.standardsOfConduct) {
      errors.push('Standards of Conduct signature is required.');
    }

    if (targetSection === 15) {
      for (let index = 1; index <= 14; index += 1) errors.push(...getSectionErrors(index));
    }

    if (targetSection === 16) {
      if (!payload.applicantCertification.typedFullLegalName) errors.push('Applicant certification typed full legal name is required.');
      if (!payload.applicantCertification.date) errors.push('Applicant certification date is required.');
    }

    return [...new Set(errors)];
  }

  function isSectionApplicable(targetSection) {
    if (targetSection === 11) return role.drivingRequired;
    return true;
  }

  function hasRequiredSectionWork(targetSection) {
    if (!isSectionApplicable(targetSection)) return false;
    if (targetSection === 1) return !!payload.positionInformation.desiredStartDate && !!payload.positionInformation.desiredPay;
    if (targetSection === 2) return !!payload.personalInformation.fullName && !!payload.personalInformation.email && !!payload.personalInformation.phone && /^\d{4}$/.test(payload.personalInformation.ssnLast4 || '');
    if (targetSection === 3) return !!payload.workAuthorization.authorized && !!payload.workAuthorization.sponsorship && !!payload.workAuthorization.age18;
    if (targetSection === 4) return role.drivingRequired ? !!payload.availability.travelAvailability && !!payload.availability.reliableTransportation && !!payload.availability.validDriversLicense && !!payload.availability.vehicleInsurance : true;
    if (targetSection === 5) return !!payload.militaryService.served;
    if (targetSection === 6) return !!payload.education.highestLevel && !requiredEducationErrors(role, payload.education).length;
    if (targetSection === 7) return !!files.resume?.length || !!payload.languages.length || !!payload.certifications.selected?.length;
    if (targetSection === 8) return calculateEmploymentYears(payload.employmentHistory.employers || []) >= (role.minimumRelevantExperienceYears || 0) && completedRows(payload.employmentHistory.employers || [], ['employer', 'title', 'startDate']).length > 0;
    if (targetSection === 9) return !!payload.governmentEligibility.priorGovernmentContractWork && !!payload.governmentEligibility.debarred;
    if (targetSection === 10) return !getSectionErrors(10).length;
    if (targetSection === 11) return !getSectionErrors(11).length;
    if (targetSection === 12) return completedRows(payload.references || [], ['name', 'phone']).length >= 3;
    if (targetSection === 13) return !getSectionErrors(13).length;
    if (targetSection === 14) return !!payload.signatures.standardsOfConduct;
    if (targetSection === 15) return true;
    if (targetSection === 16) return !!payload.applicantCertification.typedFullLegalName && !!payload.applicantCertification.date;
    return false;
  }

  function nextApplicableSection(start) {
    for (let index = start; index <= APPLICATION_TOTAL_SECTIONS; index += 1) {
      if (isSectionApplicable(index)) return index;
    }
    return section;
  }

  function previousApplicableSection(start) {
    for (let index = start; index >= 1; index -= 1) {
      if (isSectionApplicable(index)) return index;
    }
    return section;
  }

  function validateCurrent() {
    const targetSection = section === 16 ? 15 : section;
    const errors = getSectionErrors(targetSection);
    setError(errors.join(' '));
    return !errors.length;
  }

  function validateAll() {
    const errors = [];
    for (let index = 1; index <= APPLICATION_TOTAL_SECTIONS; index += 1) {
      if (!isSectionApplicable(index)) continue;
      if (index === 16) continue;
      errors.push(...getSectionErrors(index));
    }
    setError([...new Set(errors)].join(' '));
    return !errors.length;
  }

  async function saveDraft() {
    try {
      await api('/api/application/draft', {
        method: 'POST',
        body: JSON.stringify({ roleSlug: role.slug, section, payload })
      });
      setSaved(`Draft saved at ${new Date().toLocaleTimeString()}`);
      setError('');
      return true;
    } catch (err) {
      setError(err.message || 'Saving the draft failed. Please try again.');
      return false;
    }
  }

  async function saveAndExit() {
    if (await saveDraft()) navigate('/portal/applicant/application');
  }

  async function deleteAndExit() {
    try {
      await api('/api/application/draft', {
        method: 'DELETE',
        body: JSON.stringify({ roleSlug: role.slug })
      });
      setShowDeleteConfirm(false);
      setPayload(initialPayload(role, user));
      setFiles({});
      navigate('/portal/applicant/application');
    } catch (err) {
      setShowDeleteConfirm(false);
      setError(err.message || 'Deleting the draft failed. Please try again.');
    }
  }

  async function submit() {
    if (!validateAll()) return;
    const uploadBytes = totalSelectedUploadBytes(files);
    const oversizedFile = Object.values(files).flat().find((file) => Number(file?.size || 0) > uploadLimits.maxFileBytes);
    if (oversizedFile) {
      setError(`${oversizedFile.name} is ${formatMegabytes(oversizedFile.size)}. Keep each file under ${formatMegabytes(uploadLimits.maxFileBytes)}.`);
      return;
    }
    if (uploadBytes > uploadLimits.maxRequestBytes) {
      setError(`Uploaded attachments total ${formatMegabytes(uploadBytes)}. Keep all uploaded files under ${formatMegabytes(uploadLimits.maxRequestBytes)} combined.`);
      return;
    }
    const form = new FormData();
    form.append('roleSlug', role.slug);
    form.append('payload', JSON.stringify(payload));
    for (const [field, fileList] of Object.entries(files)) {
      for (const file of fileList) form.append(field, file);
    }
    try {
      const data = await api('/api/application/submit', { method: 'POST', body: form });
      setConfirmation(data.confirmation);
      setError('');
    } catch (err) {
      setError(err.message || 'Application submission failed. Please review your uploads and try again.');
    }
  }

  function next() {
    if (validateCurrent()) setSection((current) => nextApplicableSection(current + 1));
  }

  function sectionComplete(index) {
    const targetSection = index + 1;
    if (targetSection === 16) return !getSectionErrors(15).length;
    return isSectionApplicable(targetSection) && hasRequiredSectionWork(targetSection) && getSectionErrors(targetSection).length === 0;
  }

  if (loading) return <div className="boot-screen">Loading application...</div>;
  if (!role || !payload) {
    return (
      <main className="application-shell">
        <section className="application-card">
          <h1>404</h1>
          <p>That role could not be found.</p>
          <Link className="button-link" to="/portal/applicant/jobs">Back to Jobs</Link>
        </section>
      </main>
    );
  }

  if (submittedApplication) {
    return (
      <main className="application-shell">
        <section className="application-card confirmation-card">
          <span className="eyebrow">Application Already Submitted</span>
          <h1>{role.title}</h1>
          <p>You already submitted an Alpha Recovery employment application for this role.</p>
          <p>Application number: <strong>{submittedApplication.confirmation_number || 'Not assigned'}</strong></p>
          <Link className="button-link" to="/portal/applicant/application">Return to My Application</Link>
        </section>
      </main>
    );
  }

  if (confirmation) {
    return (
      <main className="application-shell">
        <section className="application-card confirmation-card">
          <span className="eyebrow">Application Received</span>
          <h1>Thank you, {payload.personalInformation.fullName}</h1>
          <p>Your Alpha Recovery employment application for {role.title} has been received in the portal. Reference: <strong>{confirmation}</strong>.</p>
          <Link className="button-link" to="/portal/applicant">Return to Portal</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="application-shell">
      <aside className="application-rail">
        <Link to="/portal/applicant" className="rail-brand">ALPHA RECOVERY</Link>
        <div>
          <span className="eyebrow">Employment Application</span>
          <h2>{role.title}</h2>
          <p>{role.department} / {role.location}</p>
        </div>
        <div className="application-progress">
          <strong>Section {visibleSectionNumber(section)} of {DISPLAY_TOTAL_SECTIONS}</strong>
          <div><span style={{ width: `${(visibleSectionNumber(section) / DISPLAY_TOTAL_SECTIONS) * 100}%` }} /></div>
          <small>{SECTION_TITLES[section - 1]}</small>
        </div>
        <nav className="section-jump">
          {SECTION_TITLES.map((title, index) => {
            const targetSection = index + 1;
            const applicable = isSectionApplicable(targetSection);
            const complete = sectionComplete(index);
            return (
              <button
                key={title}
                type="button"
                disabled={!applicable}
                className={`${section === targetSection ? 'active' : ''} ${complete ? 'complete' : ''} ${!applicable ? 'not-applicable' : ''}`}
                onClick={() => applicable && setSection(targetSection)}
              >
                <span>{visibleSectionNumber(targetSection)}. {title}</span>
                {complete && <strong aria-label="Complete">&#10003;</strong>}
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="application-card">
        <div className="application-card-header">
          <div>
            <span className="eyebrow">Section {visibleSectionNumber(section)}</span>
            <h1>{SECTION_TITLES[section - 1]}</h1>
          </div>
          <div className="exit-actions">
            <button type="button" onClick={saveAndExit}>Save and Exit</button>
            <button type="button" className="danger-button" onClick={() => setShowDeleteConfirm(true)}>Delete and Exit</button>
          </div>
        </div>
        {error && <div className="form-error">{error}</div>}
        {saved && <div className="empty-state">{saved}</div>}

        {section === 1 && <PositionSection payload={payload} patch={patch} />}
        {section === 2 && <PersonalSection payload={payload} patch={patch} />}
        {section === 3 && <AuthorizationSection payload={payload} patch={patch} />}
        {section === 4 && <AvailabilitySection role={role} payload={payload} patch={patch} />}
        {section === 5 && <MilitarySection role={role} payload={payload} patch={patch} files={files} setFiles={setFiles} uploadLimits={uploadLimits} />}
        {section === 6 && <EducationSection role={role} payload={payload} patch={patch} files={files} setFiles={setFiles} uploadLimits={uploadLimits} />}
        {section === 7 && <CertificationSection role={role} certOptions={certOptions} payload={payload} setTop={setTop} files={files} setFiles={setFiles} uploadLimits={uploadLimits} />}
        {section === 8 && <EmploymentSection role={role} payload={payload} patch={patch} />}
        {section === 9 && <GovernmentSection payload={payload} patch={patch} />}
        {section === 10 && <CriminalSection payload={payload} patch={patch} />}
        {section === 11 && <DrivingSection role={role} payload={payload} patch={patch} files={files} setFiles={setFiles} uploadLimits={uploadLimits} />}
        {section === 12 && <ReferencesSection payload={payload} setTop={setTop} />}
        {section === 13 && <BackgroundAuthorizationSection role={role} payload={payload} setBackgroundAuthorization={setBackgroundAuthorization} />}
        {section === 14 && <StandardsSection payload={payload} setTop={setTop} />}
        {section === 15 && <ReviewSection role={role} payload={payload} files={files} setSection={setSection} getSectionErrors={getSectionErrors} isSectionApplicable={isSectionApplicable} />}
        {section === 16 && <ApplicantCertificationSection payload={payload} setApplicantCertification={setApplicantCertification} />}

        <div className="application-actions">
          <button type="button" disabled={section === 1} onClick={() => setSection((current) => previousApplicableSection(current - 1))}>Back</button>
          {section < APPLICATION_TOTAL_SECTIONS ? <button type="button" onClick={next}>Continue</button> : <button type="button" onClick={submit}>Send Application</button>}
        </div>
      </section>
      {showDeleteConfirm && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-application-title">
          <div className="confirm-modal">
            <span className="eyebrow">Confirm Deletion</span>
            <h2 id="delete-application-title">Delete Application Data?</h2>
            <p>All information entered in this application will be lost and cannot be recovered. This includes any saved draft data for this role.</p>
            <div className="modal-actions">
              <button type="button" className="danger-button" onClick={deleteAndExit}>Delete</button>
              <button type="button" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function PositionSection({ payload, patch }) {
  const data = payload.positionInformation;
  return <div className="form-grid">
    <Field label="Position Applying For"><TextInput value={data.roleTitle} onChange={() => {}} readOnly /></Field>
    <Field label="Department"><TextInput value={data.department} onChange={() => {}} readOnly /></Field>
    <Field label="Location"><TextInput value={data.location} onChange={() => {}} readOnly /></Field>
    <Field label="Employment Type"><TextInput value={data.employmentType} onChange={() => {}} readOnly /></Field>
    <Field label="Desired Start Date"><TextInput type="date" value={data.desiredStartDate} onChange={(value) => patch('positionInformation', { desiredStartDate: value })} required /></Field>
    <Field label="Desired Salary or Hourly Rate"><TextInput value={data.desiredPay} onChange={(value) => patch('positionInformation', { desiredPay: value })} required /></Field>
    <Field label="How did you hear about us?"><SelectInput value={data.heardAboutUs} onChange={(value) => patch('positionInformation', { heardAboutUs: value })} options={['Alpha Recovery website', 'Referral', 'LinkedIn', 'Indeed', 'Recruiter', 'Other']} /></Field>
  </div>;
}

function PersonalSection({ payload, patch }) {
  const data = payload.personalInformation;
  return <div className="form-grid">
    <Field label="Full Legal Name"><TextInput value={data.fullName} onChange={() => {}} readOnly required /></Field>
    <Field label="Email"><TextInput type="email" value={data.email} onChange={() => {}} readOnly required /></Field>
    <Field label="Phone"><TextInput value={data.phone} onChange={() => {}} readOnly required /></Field>
    <Field label="Last 4 of SSN"><TextInput value={data.ssnLast4} onChange={(value) => patch('personalInformation', { ssnLast4: value.replace(/\D/g, '').slice(0, 4) })} required placeholder="1234" /></Field>
    <Field label="Street Address"><TextInput value={data.address} onChange={(value) => patch('personalInformation', { address: value })} /></Field>
    <Field label="City"><TextInput value={data.city} onChange={(value) => patch('personalInformation', { city: value })} /></Field>
    <Field label="State"><TextInput value={data.state} onChange={(value) => patch('personalInformation', { state: value })} /></Field>
    <Field label="ZIP"><TextInput value={data.zip} onChange={(value) => patch('personalInformation', { zip: value })} /></Field>
    <div className="empty-state">This application uses your applicant profile for name, email, and phone. Update those details from portal settings if they change.</div>
  </div>;
}

function AuthorizationSection({ payload, patch }) {
  const data = payload.workAuthorization;
  return <div className="form-grid">
    <Field label="Authorized to work in the United States?"><SelectInput value={data.authorized} onChange={(value) => patch('workAuthorization', { authorized: value })} options={yesNo()} required /></Field>
    <Field label="Will you require sponsorship?"><SelectInput value={data.sponsorship} onChange={(value) => patch('workAuthorization', { sponsorship: value })} options={yesNo()} required /></Field>
    <Field label="Are you at least 18 years of age?"><SelectInput value={data.age18} onChange={(value) => patch('workAuthorization', { age18: value })} options={yesNo()} required /></Field>
    <Field label="Eligibility Notes"><textarea value={data.proof} onChange={(event) => patch('workAuthorization', { proof: event.target.value })} /></Field>
  </div>;
}

function AvailabilitySection({ role, payload, patch }) {
  const data = payload.availability;
  return <div className="form-grid">
    {role.drivingRequired ? <Field label="Travel Availability"><SelectInput value={data.travelAvailability} onChange={(value) => patch('availability', { travelAvailability: value })} options={role.travel} required /></Field> : <Field label="Travel Availability"><TextInput value="None" onChange={() => {}} readOnly /></Field>}
    {role.drivingRequired && <>
      <Field label="Reliable Transportation"><SelectInput value={data.reliableTransportation} onChange={(value) => patch('availability', { reliableTransportation: value })} options={yesNo()} required /></Field>
      <Field label="Valid Driver's License"><SelectInput value={data.validDriversLicense} onChange={(value) => patch('availability', { validDriversLicense: value })} options={yesNo()} required /></Field>
      <Field label="Vehicle Insurance"><SelectInput value={data.vehicleInsurance} onChange={(value) => patch('availability', { vehicleInsurance: value })} options={yesNo()} required /></Field>
    </>}
    <Field label="Schedule Notes"><textarea value={data.scheduleNotes} onChange={(event) => patch('availability', { scheduleNotes: event.target.value })} /></Field>
  </div>;
}

function MilitarySection({ role, payload, patch, files, setFiles, uploadLimits }) {
  const data = payload.militaryService;
  const uploads = getSectionUploads(5, role, payload);
  return <div className="stack-list">
    <div className="form-grid">
      <Field label="Have you served in the U.S. Armed Forces?"><SelectInput value={data.served} onChange={(value) => patch('militaryService', { served: value })} options={yesNo()} required /></Field>
      {data.served === 'Yes' && <>
        <Field label="Branch"><SelectInput value={data.branch} onChange={(value) => patch('militaryService', { branch: value })} options={militaryBranches} required /></Field>
        {data.branch === 'Other' && <Field label="Other Branch"><TextInput value={data.branchOther} onChange={(value) => patch('militaryService', { branchOther: value })} required /></Field>}
        <Field label="Status / Discharge Type"><SelectInput value={data.dischargeType} onChange={(value) => patch('militaryService', { dischargeType: value })} options={dischargeTypes} required /></Field>
        {data.dischargeType === 'Other' && (
          <Field label="Explain Other Discharge Type">
            <textarea maxLength={1000} value={data.dischargeOther || ''} onChange={(event) => patch('militaryService', { dischargeOther: event.target.value })} required />
            <small>{(data.dischargeOther || '').length}/1000 characters</small>
          </Field>
        )}
        <Field label="Disabled Veteran Status"><SelectInput value={data.disabledVeteran} onChange={(value) => patch('militaryService', { disabledVeteran: value })} options={yesNo()} required /></Field>
      </>}
    </div>
    {!!uploads.length && <UploadFieldList uploads={uploads} files={files} setFiles={setFiles} uploadLimits={uploadLimits} intro="Upload military documentation based on your current military status." />}
  </div>;
}

function EducationSection({ role, payload, patch, files, setFiles, uploadLimits }) {
  const data = payload.education;
  const requirements = role.requiredEducation || [];
  const useExperienceAlternative = usesExperienceEducationAlternative(data);
  const uploads = getSectionUploads(6, role, payload);
  return <div className="stack-list">
    {!!requirements.length && <div className="legal-notice">
      <strong>Education requirement for this role.</strong>
      <span>{requirements.map((item) => EDUCATION_REQUIREMENT_LABELS[item] || item).join(' and ')} must be documented in this section, unless you request the 10+ year experience alternative and upload a narrative.</span>
    </div>}
    <Field label="Highest Education Level"><SelectInput value={data.highestLevel} onChange={(value) => patch('education', { highestLevel: value })} options={degreeTypes} required /></Field>
    {!!requirements.length && <label className="check-row consent-row">
      <input
        type="checkbox"
        checked={useExperienceAlternative}
        onChange={(event) => {
          const checked = event.target.checked;
          patch('education', { useExperienceAlternative: checked });
          setFiles((current) => {
            const next = { ...current };
            if (checked) delete next.degree;
            else delete next.educationExperienceNarrative;
            return next;
          });
        }}
      />
      I would like to use 10+ years of relevant experience as an alternative to the education requirement.
    </label>}
    {useExperienceAlternative && <div className="legal-notice">
      <strong>Experience narrative required.</strong>
      <span>Upload a separate narrative document explaining the experience you want considered. Do not type the narrative into this application. Final approval requires at least {EXPERIENCE_ALTERNATIVE_MIN_YEARS} years documented in Employment History.</span>
    </div>}
    {data.degrees.map((degree, index) => <div className="list-card form-grid" key={index}>
      <Field label="School"><TextInput value={degree.school} onChange={(value) => patch('education', { degrees: updateList(data.degrees, index, { school: value }) })} /></Field>
      <Field label="Degree"><SelectInput value={degree.degree} onChange={(value) => patch('education', { degrees: updateList(data.degrees, index, { degree: value }) })} options={degreeTypes} /></Field>
      <Field label="Field"><TextInput value={degree.field} onChange={(value) => patch('education', { degrees: updateList(data.degrees, index, { field: value }) })} /></Field>
      <Field label="Graduation Date"><TextInput type="date" value={degree.graduationYear} onChange={(value) => patch('education', { degrees: updateList(data.degrees, index, { graduationYear: value }) })} /></Field>
      <div className="inline-action"><button type="button" className="danger-button" onClick={() => patch('education', { degrees: data.degrees.filter((_, itemIndex) => itemIndex !== index) || [{ ...emptyDegree }] })} disabled={data.degrees.length === 1}>Remove Education</button></div>
    </div>)}
    <button type="button" onClick={() => patch('education', { degrees: [...data.degrees, { ...emptyDegree }] })}>Add Education</button>
    {!!uploads.length && <UploadFieldList uploads={uploads} files={files} setFiles={setFiles} uploadLimits={uploadLimits} intro={useExperienceAlternative ? 'Upload the required experience narrative document here. Do not type the narrative into the application.' : 'Upload any required degree, diploma, GED, or transcript documentation here.'} />}
  </div>;
}

function CertificationSection({ role, certOptions, payload, setTop, files, setFiles, uploadLimits }) {
  const records = payload.certifications.records || [];
  const selected = payload.certifications.selected || [];
  const uploads = getSectionUploads(7, role, payload);
  return <div className="stack-list">
    <UploadFieldList uploads={uploads} files={files} setFiles={setFiles} uploadLimits={uploadLimits} intro="Upload your resume here. Any professional license or certification documents for this section also belong here." />
    {!certOptions.length && role.languageRole === 'none' && <div className="empty-state">No specialized certifications or languages are tracked for this role beyond the required resume upload.</div>}
    {!!certOptions.length && <div className="checkbox-grid">
      {certOptions.map((cert) => <label key={`${cert.group}-${cert.name}`} className="check-row"><input type="checkbox" checked={selected.includes(cert.name)} onChange={(event) => {
        const next = event.target.checked ? [...selected, cert.name] : selected.filter((name) => name !== cert.name);
        setTop('certifications', { ...payload.certifications, selected: next });
      }} /> {cert.name}</label>)}
    </div>}
    {!!selected.length && <>
      <h3>Certification Details</h3>
      {selected.map((name) => {
        const index = records.findIndex((item) => item.name === name);
        const record = index >= 0 ? records[index] : { ...emptyCertification, name };
        function save(change) {
          const next = index >= 0 ? updateList(records, index, change) : [...records, { ...record, ...change }];
          setTop('certifications', { ...payload.certifications, records: next });
        }
        return <div className="list-card form-grid" key={name}>
          <Field label="License/Certification Name"><TextInput value={record.name} onChange={(value) => save({ name: value })} /></Field>
          <Field label="License Number"><TextInput value={record.licenseNumber} onChange={(value) => save({ licenseNumber: value })} /></Field>
          <Field label="State"><TextInput value={record.state} onChange={(value) => save({ state: value })} /></Field>
          <Field label="Expiration Date"><TextInput type="date" value={record.expirationDate} onChange={(value) => save({ expirationDate: value })} /></Field>
          <Field label="Current Status"><TextInput value={record.status} onChange={(value) => save({ status: value })} /></Field>
        </div>;
      })}
    </>}
    {role.languageRole !== 'none' && <LanguageModule required={role.languageRole === 'required'} payload={payload} setTop={setTop} />}
  </div>;
}

function LanguageModule({ required, payload, setTop }) {
  return <div className="stack-list">
    <h3>Languages {required ? '(Required)' : '(Optional)'}</h3>
    {payload.languages.map((item, index) => <div className="list-card form-grid" key={index}>
      <Field label="Language"><SelectInput value={item.language} onChange={(value) => setTop('languages', updateList(payload.languages, index, { language: value }))} options={LANGUAGES} /></Field>
      <Field label="Proficiency"><SelectInput value={item.proficiency} onChange={(value) => setTop('languages', updateList(payload.languages, index, { proficiency: value }))} options={['Native', 'Fluent', 'Professional', 'Conversational', 'Basic']} /></Field>
      <div className="checkbox-grid">
        {['Speak', 'Read', 'Write', 'Interpret', 'Translate'].map((skill) => <label key={skill} className="check-row"><input type="checkbox" checked={(item.skills || []).includes(skill)} onChange={(event) => {
          const skills = event.target.checked ? [...(item.skills || []), skill] : (item.skills || []).filter((value) => value !== skill);
          setTop('languages', updateList(payload.languages, index, { skills }));
        }} /> {skill}</label>)}
      </div>
      <Field label="Certification"><TextInput value={item.certification} onChange={(value) => setTop('languages', updateList(payload.languages, index, { certification: value }))} /></Field>
      <div className="inline-action"><button type="button" className="danger-button" onClick={() => setTop('languages', payload.languages.filter((_, itemIndex) => itemIndex !== index))}>Remove Language</button></div>
    </div>)}
    <button type="button" onClick={() => setTop('languages', [...payload.languages, { ...emptyLanguage }])}>Add Language</button>
  </div>;
}

function EmploymentSection({ role, payload, patch }) {
  const data = payload.employmentHistory;
  const years = calculateEmploymentYears(data.employers || []);
  return <div className="stack-list">
    <div className="legal-notice">
      <strong>Experience requirement for this role.</strong>
      <span>This position requires at least {role.minimumRelevantExperienceYears || 0} years of relevant experience. The application counts time across your employment dates, so two long-term employers can satisfy the requirement if the dates support it.</span>
    </div>
    <div className="form-grid">
      <Field label="Calculated Relevant Experience"><TextInput value={`${years} years`} onChange={() => {}} readOnly /></Field>
      <Field label="Experience Summary"><textarea value={data.summary} onChange={(event) => patch('employmentHistory', { summary: event.target.value })} /></Field>
    </div>
    {data.employers.map((employer, index) => <div className="list-card form-grid" key={index}>
      <Field label="Employer"><TextInput value={employer.employer} onChange={(value) => patch('employmentHistory', { employers: updateList(data.employers, index, { employer: value }) })} /></Field>
      <Field label="Title"><TextInput value={employer.title} onChange={(value) => patch('employmentHistory', { employers: updateList(data.employers, index, { title: value }) })} /></Field>
      <Field label="Start Date"><TextInput type="date" value={employer.startDate} onChange={(value) => patch('employmentHistory', { employers: updateList(data.employers, index, { startDate: value }) })} /></Field>
      <Field label="End Date"><TextInput type="date" value={employer.endDate} onChange={(value) => patch('employmentHistory', { employers: updateList(data.employers, index, { endDate: value }) })} /></Field>
      <Field label="Supervisor"><TextInput value={employer.supervisor} onChange={(value) => patch('employmentHistory', { employers: updateList(data.employers, index, { supervisor: value }) })} /></Field>
      <Field label="Phone"><TextInput value={employer.phone} onChange={(value) => patch('employmentHistory', { employers: updateList(data.employers, index, { phone: value }) })} /></Field>
      <Field label="Reason for Leaving"><TextInput value={employer.reasonForLeaving} onChange={(value) => patch('employmentHistory', { employers: updateList(data.employers, index, { reasonForLeaving: value }) })} /></Field>
      <Field label="Duties"><textarea value={employer.duties} onChange={(event) => patch('employmentHistory', { employers: updateList(data.employers, index, { duties: event.target.value }) })} /></Field>
      <div className="inline-action"><button type="button" className="danger-button" onClick={() => patch('employmentHistory', { employers: data.employers.filter((_, itemIndex) => itemIndex !== index) || [{ ...emptyEmployer }] })} disabled={data.employers.length === 1}>Remove Employer</button></div>
    </div>)}
    <button type="button" onClick={() => patch('employmentHistory', { employers: [...data.employers, { ...emptyEmployer }] })}>Add Employer</button>
  </div>;
}

function GovernmentSection({ payload, patch }) {
  const data = payload.governmentEligibility;
  return <div className="form-grid">
    <Field label="Prior Government Contract Work"><SelectInput value={data.priorGovernmentContractWork} onChange={(value) => patch('governmentEligibility', { priorGovernmentContractWork: value })} options={yesNo()} /></Field>
    <Field label="Agency / Contract"><TextInput value={data.agency} onChange={(value) => patch('governmentEligibility', { agency: value })} /></Field>
    <Field label="Clearance Held"><TextInput value={data.clearanceHeld} onChange={(value) => patch('governmentEligibility', { clearanceHeld: value })} /></Field>
    <Field label="Debarred or excluded from federal contracting?"><SelectInput value={data.debarred} onChange={(value) => patch('governmentEligibility', { debarred: value })} options={yesNo()} /></Field>
    <Field label="Notes"><textarea value={data.notes} onChange={(event) => patch('governmentEligibility', { notes: event.target.value })} /></Field>
  </div>;
}

function CriminalSection({ payload, patch }) {
  const data = payload.criminalHistory;
  const offenses = data.offenses || [];
  const anyYes = CRIMINAL_SCREENING.some(([key]) => data[key] === 'Yes');

  function setOffense(index, change) {
    patch('criminalHistory', { offenses: updateList(offenses, index, change) });
  }

  return <div className="stack-list">
    <div className="legal-notice">
      <strong>Fair-chance notice.</strong> Alpha Recovery LLC performs background-sensitive and government-contract work, so criminal history is collected as a job-related part of the screening process. A criminal record does not automatically disqualify you. Each disclosure is assessed individually based on the nature and gravity of the offense, the time that has passed, and its relevance to the duties of the position, including any evidence of rehabilitation.
      <span>You are <em>not</em> required to disclose: arrests that did not lead to a conviction (except where job-related and permitted by law); records that have been sealed, expunged, dismissed, eradicated, or annulled; or convictions for which you received a full pardon, in any jurisdiction where such inquiry is prohibited.</span>
    </div>

    <div className="form-grid">
      {CRIMINAL_SCREENING.map(([key, question]) => (
        <Field key={key} label={question}>
          <SelectInput value={data[key]} onChange={(value) => patch('criminalHistory', { [key]: value })} options={yesNo()} required />
        </Field>
      ))}
    </div>

    {anyYes && <>
      <h3>Offense Details</h3>
      <p>List each offense you answered "Yes" to above. Provide one entry per offense. If a field does not apply, enter "N/A".</p>
      {offenses.map((offense, index) => <div className="list-card form-grid" key={index}>
        <Field label="Offense Type"><SelectInput value={offense.type} onChange={(value) => setOffense(index, { type: value })} options={['Felony', 'Misdemeanor', 'Infraction', 'Military', 'Other']} /></Field>
        <Field label="Charge / Offense"><TextInput value={offense.offense} onChange={(value) => setOffense(index, { offense: value })} /></Field>
        <Field label="Date of Offense / Conviction"><TextInput type="date" value={offense.offenseDate} onChange={(value) => setOffense(index, { offenseDate: value })} /></Field>
        <Field label="Jurisdiction (City / County / State / Federal)"><TextInput value={offense.jurisdiction} onChange={(value) => setOffense(index, { jurisdiction: value })} /></Field>
        <Field label="Court"><TextInput value={offense.court} onChange={(value) => setOffense(index, { court: value })} /></Field>
        <Field label="Disposition"><SelectInput value={offense.disposition} onChange={(value) => setOffense(index, { disposition: value })} options={['Convicted', 'Pending / Awaiting Trial', 'Deferred Adjudication', 'Diversion Program', 'Probation Before Judgment', 'Dismissed', 'Acquitted / Not Guilty', 'Other']} /></Field>
        <Field label="Sentence / Penalty Imposed"><TextInput value={offense.sentence} onChange={(value) => setOffense(index, { sentence: value })} /></Field>
        <Field label="Current Status"><SelectInput value={offense.status} onChange={(value) => setOffense(index, { status: value })} options={['Completed / Fully Discharged', 'On Probation', 'On Parole', 'Incarcerated', 'Pending Trial', 'Other']} /></Field>
        <Field label="Circumstances, Rehabilitation & Restitution"><textarea value={offense.context} onChange={(event) => setOffense(index, { context: event.target.value })} /></Field>
        <div className="inline-action"><button type="button" className="danger-button" onClick={() => patch('criminalHistory', { offenses: offenses.filter((_, itemIndex) => itemIndex !== index) })}>Remove Offense</button></div>
      </div>)}
      <button type="button" onClick={() => patch('criminalHistory', { offenses: [...offenses, { ...emptyOffense }] })}>Add Offense</button>
    </>}

    <div className="conduct-notice">
      I certify that the answers given in this section are true, accurate, and complete to the best of my knowledge. I understand that knowingly providing false, incomplete, or misleading information, or omitting a required disclosure, is grounds for rejecting this application or, if discovered after hire, for withdrawal of an offer or termination of employment or contract. I understand that any disclosed record will be evaluated individually and will not automatically bar consideration.
    </div>
    <label className="check-row consent-row">
      <input type="checkbox" checked={!!data.acknowledgment} onChange={(event) => patch('criminalHistory', { acknowledgment: event.target.checked })} />
      I have read and understand the notice above, and I have answered every question in this section truthfully and completely.
    </label>
  </div>;
}

function DrivingSection({ role, payload, patch, files, setFiles, uploadLimits }) {
  if (!role.drivingRequired) return <div className="empty-state">This section is hidden for this role because driving is not required.</div>;
  const data = payload.drivingRecord;
  const uploads = getSectionUploads(11, role, payload);
  return <div className="stack-list">
    <div className="form-grid">
      <Field label="Valid Driver's License?"><SelectInput value={data.validLicense} onChange={(value) => patch('drivingRecord', { validLicense: value })} options={yesNo()} required /></Field>
      <Field label="License Number"><TextInput value={data.licenseNumber} onChange={(value) => patch('drivingRecord', { licenseNumber: value })} required /></Field>
      <Field label="State"><TextInput value={data.state} onChange={(value) => patch('drivingRecord', { state: value })} required /></Field>
      <Field label="CDL?"><SelectInput value={data.cdl} onChange={(value) => patch('drivingRecord', { cdl: value })} options={yesNo()} /></Field>
      <Field label="Moving Violations in Last 5 Years"><TextInput type="number" value={data.movingViolations} onChange={(value) => patch('drivingRecord', { movingViolations: value })} /></Field>
      <Field label="Accidents in Last 5 Years"><TextInput type="number" value={data.accidents} onChange={(value) => patch('drivingRecord', { accidents: value })} /></Field>
      <Field label="DUI History"><textarea value={data.duiHistory} onChange={(event) => patch('drivingRecord', { duiHistory: event.target.value })} /></Field>
    </div>
    {!!uploads.length && <UploadFieldList uploads={uploads} files={files} setFiles={setFiles} uploadLimits={uploadLimits} intro="Upload the driver's license documentation for this section here." />}
  </div>;
}

function ReferencesSection({ payload, setTop }) {
  return <div className="stack-list">
    {payload.references.map((reference, index) => <div className="list-card form-grid" key={index}>
      <Field label="Name"><TextInput value={reference.name} onChange={(value) => setTop('references', updateList(payload.references, index, { name: value }))} /></Field>
      <Field label="Relationship"><TextInput value={reference.relationship} onChange={(value) => setTop('references', updateList(payload.references, index, { relationship: value }))} /></Field>
      <Field label="Company"><TextInput value={reference.company} onChange={(value) => setTop('references', updateList(payload.references, index, { company: value }))} /></Field>
      <Field label="Phone"><TextInput value={reference.phone} onChange={(value) => setTop('references', updateList(payload.references, index, { phone: value }))} /></Field>
      <Field label="Email"><TextInput type="email" value={reference.email} onChange={(value) => setTop('references', updateList(payload.references, index, { email: value }))} /></Field>
      <Field label="Years Known"><TextInput value={reference.yearsKnown} onChange={(value) => setTop('references', updateList(payload.references, index, { yearsKnown: value }))} /></Field>
    </div>)}
    <button type="button" onClick={() => setTop('references', [...payload.references, { ...emptyReference }])}>Add Reference</button>
  </div>;
}

function BackgroundAuthorizationSection({ role, payload, setBackgroundAuthorization }) {
  const data = payload.backgroundAuthorization;
  return <div className="stack-list">
    <div className="legal-notice">
      <strong>APPLICANT INFORMATION</strong>
      <span>Only the position is prefilled. Complete the rest of this authorization form yourself before continuing.</span>
    </div>
    <div className="form-grid">
      <Field label="Full Legal Name"><TextInput value={data.fullLegalName} onChange={(value) => setBackgroundAuthorization({ fullLegalName: value })} required /></Field>
      <Field label="Date of Birth"><TextInput type="date" value={data.dateOfBirth} onChange={(value) => setBackgroundAuthorization({ dateOfBirth: value })} required /></Field>
      <Field label="Social Security Number"><TextInput value={data.socialSecurityNumber} onChange={(value) => setBackgroundAuthorization({ socialSecurityNumber: value })} required placeholder="123-45-6789" /></Field>
      <Field label="Current Address"><TextInput value={data.currentAddress} onChange={(value) => setBackgroundAuthorization({ currentAddress: value })} required /></Field>
      <Field label="Position Applied For"><TextInput value={role.title} onChange={() => {}} readOnly /></Field>
    </div>

    <div className="conduct-text">
      <div className="conduct-hero">
        <span className="eyebrow">Authorization And Consent</span>
        <h3>Background Investigation Authorization</h3>
        <p>I, the undersigned, hereby authorize Alpha Recovery LLC and its designated agents to conduct a pre-employment background investigation and, if selected for employment, to initiate the federal background investigation process required for this position.</p>
      </div>
      <div className="stack-list">
        <article className="list-card">
          <strong>1. Pre-Employment Screening</strong>
          <p>Alpha Recovery LLC will conduct a pre-employment screening prior to any eAPP initiation, which includes verification of citizenship status, criminal background, credit history, employment references, education credentials, and any applicable licenses or certifications.</p>
        </article>
        <article className="list-card">
          <strong>2. Federal Background Investigation</strong>
          <p>This position requires a federal background investigation processed through the Office of Professional Responsibility, Personnel Security Division (OPR PSD). I understand that I will be required to:</p>
          <ul>
            <li>Complete the Standard Form 85P or SF-85PS (Questionnaire for Public Trust Positions) online through the NBIS eAPP system within 72 hours of eAPP initiation</li>
            <li>Submit three Signature Release Forms generated upon completion of the questionnaire</li>
            <li>Submit electronic fingerprints at an approved facility or submit two (2) SF-87 Fingerprint Cards</li>
            <li>Complete the Optional Form 306 (Declaration for Federal Employment)</li>
            <li>Complete the SSA-89 form authorizing SSN verification by the Social Security Administration</li>
            <li>Complete any additional forms required based on position designation, including PREA-related questionnaires if applicable</li>
          </ul>
        </article>
        <article className="list-card">
          <strong>3. Residency Requirement</strong>
          <p>I certify that I currently reside in the United States or its Territories, and that I have resided within the United States or its Territories for three (3) or more years out of the last five (5) years, assessed from the date I sign this form.</p>
        </article>
        <article className="list-card">
          <strong>4. Ongoing Disclosure Obligation</strong>
          <p>I understand that if employed, I am required to immediately disclose to Alpha Recovery LLC any arrest or conviction of any crime (felony or misdemeanor), traffic offenses (including DUI), or any other adverse information that may bear on my suitability for this position. Failure to disclose is grounds for immediate removal from assignment.</p>
        </article>
        <article className="list-card">
          <strong>5. Accuracy of Information</strong>
          <p>I certify that all information I have provided in my application and any related forms is true, accurate, and complete to the best of my knowledge. I understand that providing false, misleading, or incomplete information is grounds for immediate disqualification or termination and may constitute a federal offense.</p>
        </article>
        <article className="list-card">
          <strong>6. No Guarantee of Employment</strong>
          <p>I understand that initiating the background investigation process does not constitute an offer of employment. I may not be deployed to any field assignment or granted access to any program-related information until a preliminary fitness determination has been confirmed by OPR PSD.</p>
        </article>
      </div>
      <div className="conduct-notice">
        By signing below, I acknowledge that I have read, understand, and consent to the terms above. I authorize Alpha Recovery LLC and authorized federal agencies to conduct all investigations necessary to determine my suitability for this position.
      </div>
    </div>

    <div className="form-grid">
      <Field label="Typed Signature"><TextInput value={data.typedSignature} onChange={(value) => setBackgroundAuthorization({ typedSignature: value })} required /></Field>
      <Field label="Date"><TextInput type="date" value={data.signatureDate} onChange={(value) => setBackgroundAuthorization({ signatureDate: value })} required /></Field>
      <Field label="Printed Name"><TextInput value={data.printedName} onChange={(value) => setBackgroundAuthorization({ printedName: value })} required /></Field>
    </div>
  </div>;
}

function StandardsOfConductText() {
  const standards = [
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

  return (
    <div className="conduct-text">
      <div className="conduct-hero">
        <span className="eyebrow">Applicant Acknowledgment</span>
        <h3>Professional Standards</h3>
        <p>By signing below, I acknowledge that if I am selected for employment, contract work, or assignment with Alpha Recovery LLC, I will be expected to conduct myself with professionalism, integrity, accountability, and respect at all times.</p>
      </div>
      <div className="conduct-grid">
        {standards.map(([title, body]) => (
          <article key={title}>
            <strong>{title}</strong>
            <p>{body}</p>
          </article>
        ))}
      </div>
      <div className="conduct-notice">
        I understand that failure to comply with these standards may result in removal from consideration, withdrawal of an offer, termination of employment or contract relationship, removal from assignment, denial of future work opportunities, and/or referral to appropriate authorities where required by law or contract.
      </div>
    </div>
  );
}

function StandardsSection({ payload, setTop }) {
  return <div className="stack-list">
    <StandardsOfConductText />
    <p>Standards of Conduct requires your typed full legal name as an electronic signature.</p>
    <Field label="Typed Full Legal Name"><TextInput value={payload.signatures.standardsOfConduct} onChange={(value) => setTop('signatures', { ...payload.signatures, standardsOfConduct: value })} required /></Field>
  </div>;
}

function ReviewSection({ role, payload, files, setSection, getSectionErrors, isSectionApplicable }) {
  return <div className="stack-list">
    <div className="legal-notice">
      <strong>Review your application section by section.</strong>
      <span>Use the edit pencil on any card to jump back to that section before final certification.</span>
    </div>
    {SECTION_TITLES.slice(0, 14).map((title, index) => ({ title, targetSection: index + 1 }))
      .filter(({ targetSection }) => isSectionApplicable(targetSection))
      .map(({ title, targetSection }) => {
      const issues = getSectionErrors(targetSection);
      const summary = summarizeSection(targetSection, role, payload, files);
      return (
        <article key={title} className="list-card">
          <div className="record-header">
            <div>
              <h3>{visibleSectionNumber(targetSection)}. {title}</h3>
              {summary.map((line) => <p key={line}>{line}</p>)}
              {!summary.length && <p>No summary available yet.</p>}
            </div>
            <button type="button" className="button-link" onClick={() => setSection(targetSection)} aria-label={`Edit ${title}`}>&#9998;</button>
          </div>
          {issues.length ? <div className="form-error">{issues.join(' ')}</div> : <div className="empty-state">Ready for final certification.</div>}
        </article>
      );
    })}
  </div>;
}

function ApplicantCertificationSection({ payload, setApplicantCertification }) {
  const data = payload.applicantCertification;
  return <div className="stack-list">
    <div className="conduct-text">
      <div className="conduct-hero">
        <span className="eyebrow">Certification Of Accuracy</span>
        <h3>Final Applicant Certification</h3>
      </div>
      <div className="conduct-notice">
        I certify that all information provided in this application, including any attachments, supplemental forms, and supporting documentation, is true, accurate, and complete to the best of my knowledge.
      </div>
      <ul>
        <li>Any false, misleading, or incomplete statement made in connection with this application may result in disqualification from consideration, withdrawal of any offer extended, or termination of employment or assignment if discovered after hiring</li>
        <li>Alpha Recovery LLC reserves the right to verify any information provided at any point during the application, hiring, or onboarding process</li>
        <li>Omission of material information is treated with the same consequence as a false statement</li>
      </ul>
      <div className="conduct-notice">
        By typing my full legal name below, I certify that the statements made in this application are true, accurate, and complete.
      </div>
    </div>
    <div className="form-grid">
      <Field label="Typed Full Legal Name"><TextInput value={data.typedFullLegalName} onChange={(value) => setApplicantCertification({ typedFullLegalName: value })} required /></Field>
      <Field label="Date"><TextInput type="date" value={data.date} onChange={(value) => setApplicantCertification({ date: value })} required /></Field>
    </div>
  </div>;
}

function UploadFieldList({ uploads, files, setFiles, uploadLimits = DEFAULT_UPLOAD_LIMITS, intro }) {
  if (!uploads.length) return null;
  return <div className="stack-list">
    <p>{intro}</p>
    <p>Accepted file types: PDF, DOC, DOCX, JPG, PNG. Maximum file size: {formatMegabytes(uploadLimits.maxFileBytes)} per file and {formatMegabytes(uploadLimits.maxRequestBytes)} combined.</p>
    {uploads.map(({ field, status }) => <div className="upload-row" key={field}>
      <div>
        <strong>{UPLOAD_LABELS[field] || field}</strong>
        <small>{fileLabel(status)}</small>
      </div>
      <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" multiple={status !== 'required'} onChange={(event) => setFiles((current) => ({ ...current, [field]: Array.from(event.target.files || []) }))} />
      {!!files[field]?.length && <small>{files[field].map((file) => file.name).join(', ')}</small>}
    </div>)}
  </div>;
}
