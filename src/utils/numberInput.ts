export const formatNumberInputValue = (value: number | null | undefined) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return value;
};

export const parseNumberInputValue = (value: string) => {
  if (value === '' || value === '.' || !isValidNumberInputDraft(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** Empty/trailing-dot drafts are editable; signs, exponents and infinity are not. */
export const isValidNumberInputDraft = (value: string) =>
  /^\d*\.?\d*$/.test(value) && (value === '' || value === '.' || Number.isFinite(Number(value)));

export const getNumberPlaceholder = (value: number | null | undefined, fallback: string) => {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return `${value}`;
};
