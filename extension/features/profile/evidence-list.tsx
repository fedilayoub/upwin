import { EVIDENCE_LABEL } from './section-labels';

interface EvidenceListProps {
  evidence: string[];
  /**
   * The breakdown prints the heading once per open section instead of once per
   * criterion, so it opts out here.
   */
  showLabel?: boolean;
}

export function EvidenceList({ evidence, showLabel = true }: EvidenceListProps) {
  if (evidence.length === 0) return null;

  return (
    <div className="mt-2" data-profile-evidence>
      {showLabel ? (
        <p className="text-xs font-semibold text-foreground">{EVIDENCE_LABEL}</p>
      ) : null}
      <ul className="mt-1 space-y-1 text-xs leading-relaxed text-muted-foreground">
        {evidence.map((item, index) => (
          // Indexed because the model can cite the same line for two criteria.
          <li className="flex gap-1.5" key={`${index}-${item}`}>
            <span aria-hidden="true">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
