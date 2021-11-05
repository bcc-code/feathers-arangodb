export default function sanitizeFieldName(fieldName: string) {
  const tempValue = fieldName.replace(/[^a-zA-Z0-9_\[\]\.]+/g, ''); //this removes all characters except alphanumeric ones and _ [ ] and .(dot). 
  if (tempValue !== fieldName) {
      console.warn(`String was sanitized, input: ${fieldName}, output: ${tempValue}`);
  }
  return tempValue;
}
