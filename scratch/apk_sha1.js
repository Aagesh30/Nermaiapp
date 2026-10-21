const fs = require('fs');
const crypto = require('crypto');

const fd = fs.openSync('scratch/latest_v5.apk', 'r');
const stat = fs.fstatSync(fd);
const fileSize = stat.size;

// Search for End of Central Directory (EOCD)
// Read last 65KB
const eocdSearchSize = Math.min(65536, fileSize);
const buffer = Buffer.alloc(eocdSearchSize);
fs.readSync(fd, buffer, 0, eocdSearchSize, fileSize - eocdSearchSize);

let eocdOffset = -1;
for (let i = buffer.length - 22; i >= 0; i--) {
  if (buffer.readUInt32LE(i) === 0x06054b50) {
    eocdOffset = fileSize - eocdSearchSize + i;
    break;
  }
}

if (eocdOffset === -1) {
  console.log('EOCD not found');
  process.exit(1);
}

// Read Central Directory Offset from EOCD
const cdOffsetBuffer = Buffer.alloc(4);
fs.readSync(fd, cdOffsetBuffer, 0, 4, eocdOffset + 16);
const cdOffset = cdOffsetBuffer.readUInt32LE(0);

// APK Signing Block is immediately before Central Directory
// Its footer contains magic: "APK Sig Block 42" (16 bytes) preceded by 8-byte block size
const footerBuffer = Buffer.alloc(24);
fs.readSync(fd, footerBuffer, 0, 24, cdOffset - 24);
const magic = footerBuffer.subarray(8, 24).toString('ascii');
console.log('Magic:', magic);

if (magic !== 'APK Sig Block 42') {
  console.log('APK Sig Block not found');
  process.exit(1);
}

const blockSize = Number(footerBuffer.readBigUInt64LE(0));
const blockStart = cdOffset - 8 - blockSize;
console.log('Block size:', blockSize, 'start:', blockStart);

const sigBlock = Buffer.alloc(blockSize);
fs.readSync(fd, sigBlock, 0, blockSize, blockStart);

// Iterate ID-value pairs
let offset = 8; // skip leading 8-byte size
while (offset < blockSize - 24) {
  const pairLen = Number(sigBlock.readBigUInt64LE(offset));
  offset += 8;
  const id = sigBlock.readUInt32LE(offset);
  offset += 4;
  console.log('Found ID: 0x' + id.toString(16), 'Length:', pairLen - 4);
  
  if (id === 0x7109871a) { // APK Signature Scheme v2
    console.log('Parsing v2 signature block...');
    // signer-sequence length (4 bytes)
    let p = offset;
    const signersLen = sigBlock.readUInt32LE(p);
    p += 4;
    // first signer length
    const signerLen = sigBlock.readUInt32LE(p);
    p += 4;
    // signed data length
    const signedDataLen = sigBlock.readUInt32LE(p);
    p += 4;
    // skip digests
    const digestsLen = sigBlock.readUInt32LE(p);
    p += 4 + digestsLen;
    // certificates sequence
    const certsLen = sigBlock.readUInt32LE(p);
    p += 4;
    // first cert
    const certLen = sigBlock.readUInt32LE(p);
    p += 4;
    const cert = sigBlock.subarray(p, p + certLen);
    
    const sha1 = crypto.createHash('sha1').update(cert).digest('hex');
    const sha256 = crypto.createHash('sha256').update(cert).digest('hex');
    console.log('----------------------------------------------------');
    console.log('APK SIGNING CERTIFICATE SHA-1:');
    console.log(sha1.match(/.{2}/g).join(':').toUpperCase());
    console.log('APK SIGNING CERTIFICATE SHA-256:');
    console.log(sha256.match(/.{2}/g).join(':').toUpperCase());
    console.log('----------------------------------------------------');
    break;
  }
  offset += pairLen - 4;
}
fs.closeSync(fd);
