import { Link } from 'react-router-dom';
import { Logo } from '../ui/Logo';

/** Logged-out landing, mirroring the splash in App.js. This is the only route
 *  in the app that search engines should see — everything past sign-in is
 *  someone's dating profile. */
export function Splash() {
  return (
    <div className="nm-page">
      <Logo size={42} />
      <p className="nm-page__tagline">Warm connections, just around the corner</p>

      <div className="nm-page__actions">
        <Link className="nm-btn nm-btn--primary" to="/signup">
          Create Account
        </Link>
        <Link className="nm-btn nm-btn--secondary" to="/login">
          Sign In
        </Link>
      </div>

      <p className="nm-page__fineprint">
        By continuing, you agree to our{' '}
        <a href="/terms.html">Terms</a> &amp; <a href="/privacy.html">Privacy Policy</a>
      </p>
    </div>
  );
}
