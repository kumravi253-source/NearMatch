import { Screen } from '../ui/Screen';
import { EmptyState } from '../ui/EmptyState';

/** Stand-in for the feature screens. Step 2 replaces each of these with the
 *  real implementation; the shell, routing and design system around them are
 *  already final. */
export function Placeholder({
  title,
  emoji,
  note,
}: {
  title: string;
  emoji: string;
  note: string;
}) {
  return (
    <Screen title={title}>
      <EmptyState emoji={emoji} title={title} body={note} />
    </Screen>
  );
}
