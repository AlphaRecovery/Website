import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { displayLabel } from '../../../shared/constants.js';

export default function CandidateSchedule() {
  const { token } = useParams();
  const [interview, setInterview] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/api/interviews/schedule/${token}`)
      .then((data) => {
        setInterview(data.interview);
        setSelectedSlot(data.interview.scheduled_at || '');
      })
      .catch((err) => setError(err.message));
  }, [token]);

  async function submit(event) {
    event.preventDefault();
    try {
      const data = await api(`/api/interviews/schedule/${token}`, {
        method: 'PATCH',
        body: JSON.stringify({ scheduled_at: selectedSlot })
      });
      setInterview(data.interview);
      setMessage('Interview time confirmed.');
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  if (error && !interview) {
    return <main className="application-shell"><section className="application-card"><h1>Scheduling Link</h1><p>{error}</p><Link className="button-link" to="/portal/applicant">Return to Portal</Link></section></main>;
  }

  if (!interview) return <div className="boot-screen">Loading interview schedule...</div>;

  return (
    <main className="application-shell">
      <section className="application-card candidate-schedule-card">
        <span className="eyebrow">Interview Scheduling</span>
        <h1>{interview.role_title || 'Alpha Recovery Interview'}</h1>
        <p>Select one available time slot. Confirmation will notify the recruiting team.</p>
        {message && <div className="empty-state">{message}</div>}
        {error && <div className="form-error">{error}</div>}
        <dl className="details-grid">
          <div><dt>Type</dt><dd>{displayLabel(interview.interview_type)}</dd></div>
          <div><dt>Duration</dt><dd>{interview.duration_minutes} minutes</dd></div>
          <div><dt>Location</dt><dd>{interview.location || 'Provided after confirmation'}</dd></div>
          <div><dt>Meeting Link</dt><dd>{interview.meeting_link ? <a href={interview.meeting_link}>{interview.meeting_link}</a> : 'Provided after confirmation'}</dd></div>
        </dl>
        <form className="panel-form" onSubmit={submit}>
          <label>Available Time Slots
            <select value={selectedSlot} onChange={(event) => setSelectedSlot(event.target.value)} required>
              <option value="">Select a time</option>
              {(interview.available_slots || []).map((slot) => <option key={slot} value={slot}>{new Date(slot).toLocaleString()}</option>)}
            </select>
          </label>
          <label>Instructions<textarea value={interview.instructions || ''} readOnly /></label>
          <button type="submit">Confirm Interview Time</button>
        </form>
      </section>
    </main>
  );
}
