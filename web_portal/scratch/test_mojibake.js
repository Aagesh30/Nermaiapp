const fs = require('fs');

const path = 'App.tsx';
const buf = fs.readFileSync(path);

// Let's decode the raw file as latin1, then decode as utf-8 where possible, or decode corrupted UTF-8 sequences.
// When UTF-8 characters are saved as ISO-8859-1 or Windows-1252, every multibyte UTF-8 sequence turns into 2-4 bytes of Latin-1 characters:
// e.g. ðŸ... is \xF0\x9F... which is the UTF-8 encoding of emojis (U+1F000+).
// â‚¹ is \xE2\x82\xB9 which is U+20B9 (₹).
// â€” is \xE2\x80\x94 which is em-dash (—).
// â€¢ is \xE2\x80\xA2 which is bullet (•).
// âœ“ is \xE2\x9C\x93 which is checkmark (✓).
// â€¦ is \xE2\x80\xA6 which is ellipsis (…).

let str = fs.readFileSync(path, 'utf8');

// Test decoding latin1 bytes back into utf8 for corrupted substrings
function fixMojibake(input) {
  // Replace known corrupted sequences
  return input.replace(/[\xC2-\xF4][\x80-\xBF]+/g, (match) => {
    try {
      const b = Buffer.from(match, 'latin1');
      const decoded = b.toString('utf8');
      // If valid decoded utf8 doesn't contain replacement character
      if (!decoded.includes('\uFFFD')) {
        return decoded;
      }
    } catch (e) {}
    return match;
  });
}

const testSample = "ðŸ“„ Script 1 â€” â€¢ âœ“";
console.log('Sample test:');
console.log('Before:', testSample);
console.log('After:', fixMojibake(testSample));

