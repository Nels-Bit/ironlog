import { useState, type ComponentProps } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { isValidNumberInputDraft } from '../utils/numberInput';

type Props = Omit<ComponentProps<typeof motion.input>, 'value' | 'inputMode' | 'type'> & {
  label: string;
  value: number | '';
  inputMode?: 'decimal';
};
/** A focused text draft preserves "22." while workout state stores the number 22.
 * Logger and edit mode share decimal keyboard, paste validation and blur behavior. */
export const WorkoutNumberInput = ({ label, value, onChange, onKeyDown, onFocus, onBlur, className, ...props }: Props) => {
  const [draft, setDraft] = useState<string | null>(null);
  return <motion.input {...props} type="text" inputMode="decimal"
    pattern="[0-9]*[.]?[0-9]*" aria-label={label} autoComplete="off" enterKeyHint="done"
    value={draft ?? value}
    onFocus={event => { setDraft(String(value)); onFocus?.(event); }}
    onBlur={event => { setDraft(null); onBlur?.(event); }}
    onKeyDown={event => {
      onKeyDown?.(event);
      if (['e','E','+','-'].includes(event.key)) event.preventDefault();
      if (event.key === 'Enter') event.currentTarget.blur();
    }}
    onChange={event => {
      const raw = event.target.value;
      if (!isValidNumberInputDraft(raw)) return;
      setDraft(raw);
      onChange?.(event);
    }}
    className={cn(className, 'min-h-11 min-w-0 text-base')}
  />;
};
