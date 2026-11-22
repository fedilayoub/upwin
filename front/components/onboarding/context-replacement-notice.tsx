import { Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function ContextReplacementNotice({
  message,
  visible,
}: {
  message: string;
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <Alert role="status" variant="info">
      <Info />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
