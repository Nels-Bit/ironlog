export const formatNumberInputValue = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  return value;
};

export const parseNumberInputValue = (value: string) => {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export const getNumberPlaceholder = (value: number | null | undefined, fallback: string) => {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return `${value}`;
};
