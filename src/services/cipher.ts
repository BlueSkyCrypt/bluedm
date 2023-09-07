import * as forge from "node-forge";

const generateKeys = () => {
  const keypair = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
  const publicKeyPem = forge.pki.publicKeyToPem(keypair.publicKey);
  const privateKeyPem = forge.pki.privateKeyToPem(keypair.privateKey);
  
  return {
    publicKey: publicKeyPem,
    privateKey: privateKeyPem,
  };
}

const encryptWithPublicKey = (msg: string, publicKeyPem: string) => {
  const publicKey = forge.pki.publicKeyFromPem(publicKeyPem);
  const encrypted = publicKey.encrypt(forge.util.encodeUtf8(msg), 'RSA-OAEP');
  return forge.util.encode64(encrypted);
}

const decryptWithPrivateKey = (encryptedMsg: string, privateKeyPem: string) => {
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);
  const decrypted = privateKey.decrypt(forge.util.decode64(encryptedMsg), 'RSA-OAEP');
  return forge.util.decodeUtf8(decrypted);
}

const encryptWithAESKey = (msg: string, key: string) => {
  const iv = forge.random.getBytesSync(16);
  
  const cipher = forge.cipher.createCipher('AES-CBC', key);
  cipher.start({iv: iv});
  cipher.update(forge.util.createBuffer(forge.util.encodeUtf8(msg)));
  cipher.finish();
  
  const encrypted = cipher.output.getBytes();
  
  return forge.util.encode64(iv + encrypted);
}

const decryptWithAESKey = (encryptedMsg: string, key: string) => {
  const encodedData = forge.util.decode64(encryptedMsg);
  const iv = encodedData.substring(0, 16);
  const encryptedBytes = encodedData.substring(16);
  
  const decipher = forge.cipher.createDecipher('AES-CBC', key);
  decipher.start({iv: iv});
  decipher.update(forge.util.createBuffer(encryptedBytes));
  if(!decipher.finish()) {
    throw new Error('Failed to decrypt message');
  }
  
  return forge.util.decodeUtf8(decipher.output.getBytes());
}

const generateAESKey = (keySize: number = 256) => {
  const keySizeInBytes = keySize / 8;
  const key = forge.random.getBytesSync(keySizeInBytes);

  return key;
}

export {
  generateKeys,
  generateAESKey,
  encryptWithPublicKey,
  decryptWithPrivateKey,
  encryptWithAESKey,
  decryptWithAESKey,
};
