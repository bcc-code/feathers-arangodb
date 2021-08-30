export default function // this function strips query and prevents AQL injection
sanitizeFieldName(fieldName: string): string {
  let tempValue = fieldName.split(' ')[0] //we only expect single words here in normal circumstances
  tempValue = tempValue.replace(/\/\//g, ''); //this removes '//' from query
  tempValue = tempValue.replace(/\/\*|\*\//g, ''); //this removes '/*' and '*/' from query
  tempValue = tempValue.replace(/:/g, ''); //this removes ':' from query
  if (tempValue !== fieldName) {
    console.warn(`String was sanitized,
        input was: ${fieldName},
        output was: ${tempValue}.
        This is ran because adapter detected potentially unsafe characters in query. Look into query and adapter queryBuilder to make improvements.`)
    sanitizeFieldName(tempValue)
  }
  return tempValue;
}
