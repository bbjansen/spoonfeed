import { Transform } from 'class-transformer';

export function Sensitive(maskChar = '*', visibleChars = 4): PropertyDecorator {
  return Transform(
    ({ value }) => {
      if (typeof value !== 'string' || value.length <= visibleChars) return value;
      const visible = value.slice(-visibleChars);
      return maskChar.repeat(value.length - visibleChars) + visible;
    },
    { toPlainOnly: true },
  );
}
