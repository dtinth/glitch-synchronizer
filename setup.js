const { execSync } = require('child_process')
const fs = require('fs')
const passthru = { stdio: 'inherit' }
const projectName = process.argv[2]
if (!projectName) {
  throw new Error('No project name specified')
}

const ownerRepo = process.argv[3]
if (!ownerRepo || ownerRepo.split('/').length !== 2) {
  throw new Error('No owner/repo specified')
}

console.log('Glitch project name:', projectName)
console.log('')

const configPath = `projects/${projectName}.config.json`
const privateKeyPath = `projects/${projectName}.sshkey`
const publicKeyPath = `${privateKeyPath}.pub`
const encryptionKeyPath = `projects/${projectName}.enckey`
const encryptedEncryptionKeyPath = `${encryptionKeyPath}.enc`
const encryptedPrivateKeyPath = `${privateKeyPath}.enc`

// https://unix.stackexchange.com/questions/69314/automated-ssh-keygen-without-passphrase-how
if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
  console.log('Generating a deploy keypair...')
  execSync(
    `ssh-keygen -t rsa -f '${privateKeyPath}' -C 'glitch-synchronizer ${projectName} deploy key' -q -P ''`,
    passthru,
  )
}

// https://www.czeskis.com/random/openssl-encrypt-file.html
console.log('')
console.log('Generating a encryption key...')
execSync(`openssl rand -base64 32 > '${encryptionKeyPath}'`, passthru)

console.log('')
console.log('Encrypting the encryption key...')
execSync(
  `openssl rsautl -encrypt -inkey keys/public.pem -pubin -in '${encryptionKeyPath}' -out '${encryptedEncryptionKeyPath}'`,
  passthru,
)

console.log('')
console.log('Encrypting the deploy key...')
execSync(
  `openssl enc -aes-256-cbc -md sha256 -salt -in '${privateKeyPath}' -out '${encryptedPrivateKeyPath}' -pass 'file:${encryptionKeyPath}'`,
  passthru,
)

console.log('')
console.log('Writing config...')
require('fs').writeFileSync(
  configPath,
  JSON.stringify({ targetRepo: ownerRepo }, null, 2),
)

console.log('')
console.log(`Keys generated. Add this deploy key to ${ownerRepo}:`)
execSync(`cat '${publicKeyPath}'`, passthru)
