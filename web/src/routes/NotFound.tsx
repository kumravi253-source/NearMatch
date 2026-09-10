import { Link } from 'react-router-dom';
import { EmptyState } from '../ui/EmptyState';

export function NotFound() {
  return (
    <div className="nm-page">
      <EmptyState
        emoji="🧭"
        title="Page not found"
        body="That link does not go anywhere in the app."
        action={
          <Link className="nm-btn nm-btn--ghost nm-btn--auto" to="/">
            Back to NearMatch
          </Link>
        }
      />
    </div>
  );
}
