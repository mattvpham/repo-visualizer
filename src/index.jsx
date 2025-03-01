// import * as core from '@actions/core';
// import { exec } from '@actions/exec';
import { exec } from 'child_process';
import fs from "fs";
import React from 'react';
import ReactDOMServer from 'react-dom/server';

import { processDir } from "./process-dir.js";
import { Tree } from "./Tree.tsx";

const config = {
  max_depth: 9,
  color_encoding: 'type',
  excluded_paths: "node_modules,bower_components,dist,out,build,eject,.next,.netlify,.yarn,.git,.vscode,package-lock.json,yarn.lock",
  excluded_globs: '',
  branch: 'main',
  root_path: process.argv[2] || '',
  output_file: process.argv[3] || './diagram.svg',
}

const core = {
  getInput: (key) => {
    return config[key]
  },
  setOutput: (key, value) => {
    config[key] = value
  },
  setFailed: (message) => {
    console.error(message)
  },
  info: (message) => {
    console.log(message)
  },
  startGroup: (message) => {
    console.log(`::group::${message}`)
  },
  endGroup: () => {
    console.log(`::endgroup::`)
  },
  getBooleanInput: (key) => {
    return config[key]
  }
}


const main = async () => {
  core.info('[INFO] Usage https://github.com/githubocto/repo-visualizer#readme')

  core.startGroup('Configuration')
  const username = 'repo-visualizer'
  await exec('git', ['config', 'user.name', username])
  await exec('git', [
    'config',
    'user.email',
    `${username}@users.noreply.github.com`,
  ])

  core.endGroup()


  const rootPath = core.getInput("root_path") || ""; // Micro and minimatch do not support paths starting with ./
  const maxDepth = core.getInput("max_depth") || 9
  const customFileColors = JSON.parse(core.getInput("file_colors") ||  '{}');
  const colorEncoding = core.getInput("color_encoding") || "type"
  const commitMessage = core.getInput("commit_message") || "Repo visualizer: update diagram"
  const excludedPathsString = core.getInput("excluded_paths") || "node_modules,bower_components,dist,out,build,eject,.next,.netlify,.yarn,.git,.vscode,package-lock.json,yarn.lock"
  const excludedPaths = excludedPathsString.split(",").map(str => str.trim())

  // Split on semicolons instead of commas since ',' are allowed in globs, but ';' are not + are not permitted in file/folder names.
  const excludedGlobsString = core.getInput('excluded_globs') || '';
  const excludedGlobs = excludedGlobsString.split(";");

  const branch = core.getInput("branch")
  const data = await processDir(rootPath, excludedPaths, excludedGlobs);

  let doesBranchExist = true

  if (branch) {
    await exec('git', ['fetch'])

    try {
      await exec('git', ['switch', '-c' , branch,'--track', `origin/${branch}`])
    } catch {
      doesBranchExist = false
      core.info(`Branch ${branch} does not yet exist, creating ${branch}.`)
      await exec('git', ['checkout', '-b', branch])
    }
  }
  const componentCodeString = ReactDOMServer.renderToStaticMarkup(
    <Tree data={data} maxDepth={+maxDepth} colorEncoding={colorEncoding} customFileColors={customFileColors}/>
  );

  const outputFile = core.getInput("output_file") || "./diagram.svg"

  core.setOutput('svg', componentCodeString)

  fs.writeFileSync(outputFile, componentCodeString)

  // await exec('git', ['add', outputFile])

  // const diff = await execWithOutput('git', ['status', '--porcelain', outputFile])
  // core.info(`diff: ${diff}`)
  // if (!diff) {
  //   core.info('[INFO] No changes to the repo detected, exiting')
  //   return
  // }

  const shouldPush = core.getBooleanInput('should_push')
  if (shouldPush) {
    core.startGroup('Commit and push diagram')
    await exec('git', ['commit', '-m', commitMessage])

    if (doesBranchExist) {
      await exec('git', ['push'])
    } else {
      await exec('git', ['push', '--set-upstream', 'origin', branch])
    }

    if (branch) {
      await exec('git', 'checkout', '-')
    }
    core.endGroup()
  }

  // const shouldUpload = core.getInput('artifact_name') !== ''
  // if (shouldUpload) {
  //   core.startGroup('Upload diagram to artifacts')
  //   const client = artifact.create()
  //   const result = await client.uploadArtifact(core.getInput('artifact_name'), [outputFile], '.')
  //   if (result.failedItems.length > 0) {
  //     throw 'Artifact was not uploaded successfully.'
  //   }
  //   core.endGroup()
  // }

  console.log("All set!")
}

main().catch((e) => {
  core.setFailed(e)
})

function execWithOutput(command, args) {
  return new Promise((resolve, reject) => {
    try {
      exec(command, args, {
        listeners: {
          stdout: function (res) {
            core.info(res.toString())
            resolve(res.toString())
          },
          stderr: function (res) {
            core.info(res.toString())
            reject(res.toString())
          }
        }
      })
    } catch (e) {
      reject(e)
    }
  })
}
