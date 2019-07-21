import { BaseAnswers, BaseGenerator, BaseOptions } from '@naturalcycles/yeoman-lib'
import { projectDir } from '../paths.cnst'

const YARN_DEV_DEPS = [
  '@naturalcycles/semantic-release',
  '@naturalcycles/dev-lib',
  '@types/node',
  'jest',
]

interface AllAnswers extends Answers, BaseAnswers {}

interface Answers {
  npmAccess: 'public' | 'protected'
}

class AppGenerator extends BaseGenerator {
  constructor (args: any, opts: any) {
    super(args, opts)
  }

  private answers!: AllAnswers

  async initializing (): Promise<void> {
    await this._logVersion(projectDir)
  }

  async prompting (): Promise<void> {
    const { skipQuestions } = this.options as BaseOptions

    if (skipQuestions) {
      const { answers } = this.config.getAll()
      if (answers) {
        this.answers = answers
        return
      }
    }

    const baseAnswers = await this._getBaseAnswers()

    const answers = await this.prompt<Answers>([
      {
        type: 'list',
        name: 'npmAccess',
        message: 'NPM access',
        default: 'public',
        choices: ['public', 'protected'],
        store: true,
      },
    ])

    this.answers = {
      ...baseAnswers,
      ...answers,
    }

    // this.config.setAll
    // Object.entries(this.answers).forEach(([k, v]) => this.config.set(k, v))
    this.config.set('answers', this.answers)
  }

  async writing (): Promise<void> {
    const copyOptions = { globOptions: { dot: true } }
    this.fs.copyTpl(
      this.templatePath('base/**'),
      this.destinationPath(),
      this.answers,
      undefined,
      copyOptions,
    )

    // Hack for npm publish to work
    this.fs.move(this.destinationPath('_package.json'), this.destinationPath('package.json'))
  }

  async install (): Promise<void> {
    const { skipInstall } = this.options as BaseOptions
    if (skipInstall) return

    await this.spawnCommandSync(`yarn`, ['add', '-D', ...YARN_DEV_DEPS])
    await this.spawnCommandSync(`yarn`, ['update-from-dev-lib'])
  }

  async end (): Promise<void> {
    await this._setupGit()
  }
}

export default AppGenerator
