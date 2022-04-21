import { writeFileSync } from 'fs'

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
console.log('')
console.log('Writing config...')
writeFileSync(configPath, JSON.stringify({ targetRepo: ownerRepo }, null, 2))

console.log('')
console.log('Links:')
console.log(`
|                       |     |
| --------------------- | --- |
| **Glitch project**    | https://glitch.com/~${projectName} |
| **GitHub repository** | https://github.com/${ownerRepo} |
`)
