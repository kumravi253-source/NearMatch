/** The wordmark. Pacifico is used here and nowhere else, exactly as in the
 *  mobile app and on the marketing site. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span className="nm-logo" style={{ fontSize: size }}>
      NearMatch
    </span>
  );
}
