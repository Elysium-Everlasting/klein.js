import fs from 'node:fs'
import path from 'node:path'

import { App } from 'aws-cdk-lib/core'
import { CLI_VERSION_ENV } from 'aws-cdk-lib/cx-api'
import createJITI from 'jiti'

import { getWorkspaceRoot } from './utils/project.js'

const jsExtensions = ['.js', '.mjs', '.cjs']
const tsExtensions = jsExtensions.map((extension) => extension.replace('js', 'ts'))
const extensions = [...jsExtensions, ...tsExtensions]

const configFileName = 'klein.config'

const configFiles = extensions.map((extension) => `${configFileName}${extension}`)

const workspaceRoot = getWorkspaceRoot()

export function findConfigFile(directory = process.cwd()) {
  const configFile = fs.readdirSync(directory).find((file) => configFiles.includes(file))

  if (!configFile) {
    /**
     * TODO: keep looking up the directory tree until we find a config file or the workspace root.
     */
    workspaceRoot
    return undefined
  } else {
    return path.resolve(directory, configFile)
  }
}

export async function loadAppFromConfig(directory = workspaceRoot) {
  const configFile = findConfigFile(directory)

  if (!configFile) {
    throw new Error(
      `Could not find ${configFileName} file. Please create one of ${configFiles.join(', ')}`,
    )
  }

  const jiti = createJITI(configFile)

  const exports = await jiti(configFile)

  /**
   * TODO: more sophisticated/deterministic way of finding the exported entrypoint.
   */
  const maybeApp = exports.default?.() ?? exports?.main() ?? exports

  if (!App.isApp(maybeApp)) {
    throw new Error('Config did not return an instance of a CDK App')
  }

  return exports
}

/**
 * Whether or not the current process is being executed by the CDK CLI.
 * This matters because we don't need to fully synthesize everything when only getting the config
 * for our own operations. But CDK does needs to fully synthesize and validate everything.
 */
export function isCdk() {
  /**
   * When CDK spawns a new process to synthesize the stack,
   * it generates a new "env" object using constants from the cx-api library.
   * We'll just use the presence of a designated env variable to determine if CDK is executing this.
   *
   * @link https://github.com/aws/aws-cdk/blob/c575dded26834bd55618813b74046d2f380d1940/packages/aws-cdk/lib/api/cxapp/exec.ts#L66
   */
  return process.env[CLI_VERSION_ENV] != null
}