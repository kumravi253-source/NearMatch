type Props = {
  /** A signed URL from withSignedPhotoUrls, or null. */
  photoUrl: string | null;
  /** Fallback shown when there is no photo, as on mobile. */
  emoji: string | null;
  name: string;
  size?: number;
};

export function Avatar({ photoUrl, emoji, name, size = 56 }: Props) {
  return (
    <div className="nm-avatar" style={{ width: size, height: size, fontSize: size * 0.5 }}>
      {photoUrl ? (
        // Signed URLs expire after an hour. If one 404s mid-session the
        // browser shows a broken image; alt text keeps that legible.
        <img src={photoUrl} alt={name} loading="lazy" />
      ) : (
        <span aria-hidden="true">{emoji || '🙂'}</span>
      )}
    </div>
  );
}
