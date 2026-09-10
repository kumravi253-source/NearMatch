import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useSession } from './lib/session';
import { AppShell } from './ui/AppShell';
import { LoadingPane } from './ui/Spinner';
import { Splash } from './routes/Splash';
import { NotFound } from './routes/NotFound';
import { Placeholder } from './routes/Placeholder';

const STEP_TWO = 'Coming in the next step — the shell, branding and backend wiring are in place.';

/** Routes that require a session AND a completed profile. Anything reaching
 *  here without both is redirected rather than rendered half-populated. */
function RequireProfile({ children }: { children: React.ReactNode }) {
  const { session, profile, ready } = useSession();
  const location = useLocation();

  if (!ready) return <LoadingPane label="Loading NearMatch" />;
  if (!session) return <Navigate to="/" replace state={{ from: location.pathname }} />;
  // Signed in but no profiles row yet — the mobile app sends new signups
  // straight to setup, and so does this.
  if (!profile) return <Navigate to="/setup" replace />;

  return <>{children}</>;
}

/** The logged-out pages. A signed-in user landing on one gets bounced to the
 *  app so the back button after sign-in does not show the splash again. */
function RequireAnonymous({ children }: { children: React.ReactNode }) {
  const { session, profile, ready } = useSession();

  if (!ready) return <LoadingPane label="Loading NearMatch" />;
  if (session) return <Navigate to={profile ? '/discover' : '/setup'} replace />;

  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <RequireAnonymous>
            <Splash />
          </RequireAnonymous>
        }
      />
      <Route
        path="/login"
        element={
          <RequireAnonymous>
            <Placeholder title="Sign in" emoji="💛" note={STEP_TWO} />
          </RequireAnonymous>
        }
      />
      <Route
        path="/signup"
        element={
          <RequireAnonymous>
            <Placeholder title="Create account" emoji="🌸" note={STEP_TWO} />
          </RequireAnonymous>
        }
      />

      {/* Profile setup sits outside RequireProfile — it is what a user without
          a profile row is sent to, so gating it on having one would loop. */}
      <Route path="/setup" element={<Placeholder title="Your profile" emoji="✨" note={STEP_TWO} />} />

      <Route element={<AppShell />}>
        <Route
          path="/discover"
          element={
            <RequireProfile>
              <Placeholder title="Discover" emoji="🔥" note={STEP_TWO} />
            </RequireProfile>
          }
        />
        <Route
          path="/likes"
          element={
            <RequireProfile>
              <Placeholder title="Who Liked You" emoji="💫" note={STEP_TWO} />
            </RequireProfile>
          }
        />
        <Route
          path="/matches"
          element={
            <RequireProfile>
              <Placeholder title="Matches" emoji="💛" note={STEP_TWO} />
            </RequireProfile>
          }
        />
        <Route
          path="/chat"
          element={
            <RequireProfile>
              <Placeholder title="Messages" emoji="💬" note={STEP_TWO} />
            </RequireProfile>
          }
        />
        <Route
          path="/chat/:matchId"
          element={
            <RequireProfile>
              <Placeholder title="Conversation" emoji="💬" note={STEP_TWO} />
            </RequireProfile>
          }
        />
        <Route
          path="/account"
          element={
            <RequireProfile>
              <Placeholder title="Account" emoji="⚙️" note={STEP_TWO} />
            </RequireProfile>
          }
        />
        <Route
          path="/verify"
          element={
            <RequireProfile>
              <Placeholder title="Verify your age" emoji="🤳" note={STEP_TWO} />
            </RequireProfile>
          }
        />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
