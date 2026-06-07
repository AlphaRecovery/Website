import Badge from './Badge.jsx';

export function DocumentList({ documents }) {
  return (
    <div className="stack-list">
      {documents.map((doc) => (
        <article key={doc.id} className="list-card">
          <div>
            <strong>{doc.name}</strong>
            <small>{doc.type}</small>
          </div>
          <Badge value={doc.status} />
        </article>
      ))}
    </div>
  );
}

export function TaskList({ tasks }) {
  return (
    <div className="stack-list">
      {tasks.map((task) => (
        <article key={task.id} className="list-card">
          <div>
            <strong>{task.title}</strong>
            <small>{task.description || 'No details provided'}</small>
          </div>
          <Badge value={task.status} />
        </article>
      ))}
    </div>
  );
}

export function MessageThread({ messages }) {
  return (
    <div className="stack-list">
      {messages.map((message) => (
        <article key={message.id} className="message-card">
          <strong>{message.subject || 'Portal Message'}</strong>
          <p>{message.body}</p>
          <small>{new Date(message.created_at).toLocaleString()}</small>
        </article>
      ))}
    </div>
  );
}
