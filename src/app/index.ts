import {
  AnySchemaTyped,
  convert,
  getValidationResult,
  stringSchema,
} from '@naturalcycles/nodejs-lib'
import _ = require('lodash')
import * as checkNpmName from 'npm-name'
import * as Generator from 'yeoman-generator'

const YARN_DEV_DEPS = [
  '@naturalcycles/semantic-release',
  '@naturalcycles/dev-lib',
  '@types/node',
  'jest',
]

interface Options {
  skipQuestions?: boolean
  skipInstall?: boolean
}

interface Answers1 {
  npmName: string
}

interface Answers2 {
  githubOrg: string
  githubRepoName: string
  moduleAuthor: string
  moduleLicense: string
  npmAccess: 'public' | 'protected'
}

interface Answers extends Answers1, Answers2 {
  npmScope?: string
  npmNameWithoutScope: string
  githubFullName: string
}

const githubOrgSchema = stringSchema
  .min(1)
  .max(80)
  .alphanum()
const githubRepoSchema = stringSchema
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9-_]*$/)
const notEmptyStringSchema = stringSchema

class AppGenerator extends Generator {
  constructor (args: any, opts: any) {
    super(args, opts)
    // console.log({args, opts})

    this.option('skipQuestions', {
      type: Boolean,
    })

    this.option('skipInstall', {
      type: Boolean,
    })
  }

  private answers!: Answers

  async prompting (): Promise<void> {
    const { skipQuestions } = this.options as Options

    if (skipQuestions) {
      const { answers } = this.config.getAll()
      if (answers) {
        this.answers = answers
        return
      }
    }

    const answers1 = await this.prompt<Answers1>([
      {
        name: 'npmName',
        message: 'npm project name (including scope, if needed, e.g @angular/builder)',
        default: _.kebabCase(this.appname), // Default to current folder name
        filter: _.kebabCase,
        validate: async (npmName: any) => {
          const avail = await checkNpmName(npmName).catch(err => {
            console.log(err)
            return false
          })

          if (!avail) {
            return `${npmName} npm package is not available (taken or invalid)`
          }

          return true
        },
        store: true,
      },
    ])
    const [npmNameWithoutScope, npmScope] = answers1.npmName.split('/').reverse()

    const answers2 = await this.prompt<Answers2>([
      {
        name: 'githubOrg',
        message: 'GitHub Org / Author, e.g `NaturalCycles`',
        default: 'NaturalCycles',
        filter: str => convert(str, githubOrgSchema),
        validate: (str: any) => inquirerValid(str, githubOrgSchema),
        store: true,
      },
      {
        name: 'githubRepoName',
        message: 'Repo name on Github (excluding Org name)',
        default: npmNameWithoutScope,
        filter: str => convert(str, githubRepoSchema),
        validate: (str: any) => inquirerValid(str, githubRepoSchema),
        store: true,
      },
      {
        name: 'moduleAuthor',
        message: 'package.json author',
        default: 'Natural Cycles Team',
        filter: str => convert(str, notEmptyStringSchema),
        validate: (str: any) => inquirerValid(str, notEmptyStringSchema),
        store: true,
      },
      {
        name: 'moduleLicense',
        message: 'package.json license',
        default: 'MIT',
        filter: str => convert(str, notEmptyStringSchema),
        validate: (str: any) => inquirerValid(str, notEmptyStringSchema),
        store: true,
      },
      {
        type: 'list',
        name: 'npmAccess',
        message: 'NPM access',
        default: 'public',
        choices: ['public', 'protected'],
        store: true,
      },
    ])

    const githubFullName = [answers2.githubOrg, answers2.githubRepoName].join('/')

    this.answers = {
      ...answers1,
      ...answers2,
      npmScope,
      npmNameWithoutScope,
      githubFullName,
    }

    // this.config.setAll
    // Object.entries(this.answers).forEach(([k, v]) => this.config.set(k, v))
    this.config.set('answers', this.answers)
  }

  async writing (): Promise<void> {
    // await this._generatePackageJson()

    this.fs.copyTpl(this.templatePath('base/**'), this.destinationPath(), this.answers, undefined, {
      globOptions: { dot: true },
    })

    // Hack for npm publish to work
    this.fs.move(this.destinationPath('_package.json'), this.destinationPath('package.json'))
  }

  async install (): Promise<void> {
    const { skipInstall } = this.options as Options
    if (skipInstall) return

    // const cmd = [`yarn add -D`, ...YARN_DEV_DEPS].join(' ')
    // console.log(`Will do ${c.bold.green(cmd)}`)

    // await this.yarnInstall(YARN_DEV_DEPS, {dev: true})
    await this.spawnCommandSync(`yarn`, ['add', '-D', ...YARN_DEV_DEPS])

    await this.spawnCommandSync(`yarn`, ['update-from-dev-lib'])
  }

  async end (): Promise<void> {
    await this._setupGit()
  }

  private async _setupGit (): Promise<void> {
    const { githubFullName } = this.answers

    const cmd = [
      `git init`,
      `git remote add origin git@github.com:${githubFullName}.git`,
      `git add -A`,
      `git commit -a -m "feat: first version"`,
      `git status`,
    ].join(' && ')

    await this.spawnCommandSync(cmd, [], { shell: true })
  }
}

export default AppGenerator

function inquirerValid (value: any, schema: AnySchemaTyped<any>): true | string {
  const { error } = getValidationResult(value, schema)
  return error ? error.message : true
}
