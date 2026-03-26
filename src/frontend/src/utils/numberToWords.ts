const ones = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const tens = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function convertHundreds(input: number): string {
  let n = input;
  let result = "";
  if (n >= 100) {
    result += `${ones[Math.floor(n / 100)]} Hundred `;
    n = n % 100;
  }
  if (n >= 20) {
    result += `${tens[Math.floor(n / 10)]} `;
    n = n % 10;
  }
  if (n > 0) {
    result += `${ones[n]} `;
  }
  return result;
}

function convertToWords(input: number): string {
  if (input === 0) return "Zero ";
  let n = input;
  let result = "";
  const crore = Math.floor(n / 10000000);
  n = n % 10000000;
  const lakh = Math.floor(n / 100000);
  n = n % 100000;
  const thousand = Math.floor(n / 1000);
  n = n % 1000;
  const remainder = n;

  if (crore > 0) result += `${convertHundreds(crore)}Crore `;
  if (lakh > 0) result += `${convertHundreds(lakh)}Lakh `;
  if (thousand > 0) result += `${convertHundreds(thousand)}Thousand `;
  if (remainder > 0) result += convertHundreds(remainder);

  return result.trim();
}

/**
 * Convert a number to Indian currency words.
 * e.g. 2051.61 -> "Two Thousand Fifty-One and 61/100 Only"
 */
export function numberToWords(amount: number): string {
  if (amount < 0) return `Negative ${numberToWords(-amount)}`;
  const intPart = Math.floor(amount);
  const decPart = Math.round((amount - intPart) * 100);

  let words = convertToWords(intPart);

  // fix spacing for compound tens+ones
  words = words.replace(/([A-Z][a-z]+) ([A-Z][a-z]+) /g, (_, a, b) => {
    const tensWords = [
      "Twenty",
      "Thirty",
      "Forty",
      "Fifty",
      "Sixty",
      "Seventy",
      "Eighty",
      "Ninety",
    ];
    if (tensWords.includes(a)) return `${a}-${b} `;
    return `${a} ${b} `;
  });

  words = words.trim();

  if (decPart > 0) {
    return `${words} and ${decPart}/100 Only`;
  }
  return `${words} Only`;
}
