const steps = ['submitted', 'received', 'review', 'interview', 'approved', 'onboarding'];
const labels = ['Submitted', 'Received', 'Under Review', 'Interview', 'Decision', 'Onboarding'];

export default function ProgressTracker({ status }) {
  const effectiveStatus = status === 'rejected' ? 'approved' : status;
  const currentIndex = Math.max(0, steps.indexOf(effectiveStatus));
  return (
    <div className="progress-tracker">
      {steps.map((step, index) => (
        <div key={step} className={`progress-step ${index <= currentIndex ? 'complete' : ''}`}>
          <span>{index + 1}</span>
          <strong>{labels[index]}</strong>
        </div>
      ))}
    </div>
  );
}
