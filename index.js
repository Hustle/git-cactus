#!/usr/bin/env node

const tmp = require('tmp');
const util = require('util');
const cp = require('child_process');
const yargs = require('yargs');
const logger = require('winston');
const semver = require('semver');
const Git = require('nodegit');

const exec = util.promisify(cp.exec);

logger.cli();

function makeOpts() {
  return {
    callbacks: {
      certificateCheck: () => 1,
      credentials: (url, username) => Git.Cred.sshKeyFromAgent(username)
    }
  };
}

// HACK: run require of pacakge.json after using npm to manipulate it
function getNextVersionInfo(packageJSONPath) {
  const pkg = require(`${packageJSONPath}/package.json`);
  const version = pkg.version;
  const minorVer = `v${semver.major(version)}.${semver.minor(version)}`;
  const releaseBranchName = `release-${minorVer}`;
  return { version, minorVer, releaseBranchName };
}

async function cutReleaseBranch(args) {
  // Get upstream remote for current repo
  const repo = await Git.Repository.open('.');
  const remote = await repo.getRemote(args.upstream);
  const url = remote.url();

  // Create tempdir and clone fresh copy
  const tmpdir = tmp.dirSync({ unsafeCleanup: true });
  const options = { fetchOpts: makeOpts() }

  // Clone a fresh copy of the repository
  const clonedRepo = await Git.Clone(url, tmpdir.name, options);
  const clonedRemote = await clonedRepo.getRemote('origin');

  // Shell out to run npm version inside tempdir
  await exec('npm version minor -m "Release v%s"', { cwd: tmpdir.name });

  // Determine new version and branch names
  const versionInfo = getNextVersionInfo(tmpdir.name);
  logger.info('Cutting branch', versionInfo.releaseBranchName);

  // Push master, the release branch, and tag
  await clonedRemote.push([
    `refs/heads/master:refs/heads/master`,
    `refs/heads/master:refs/heads/${versionInfo.releaseBranchName}`,
    `refs/tags/v${versionInfo.version}:refs/tags/v${versionInfo.version}`,
  ], makeOpts());

  return 'Done!';
}

async function tagVersion(args) {
  // Get upstream remote for current repo
  const repo = await Git.Repository.open('.');
  const remote = await repo.getRemote(args.upstream);

  // Shell out to run npm version
  await exec('npm version patch -m "Release v%s"');
  const versionInfo = getNextVersionInfo(process.cwd());

  // Push updated release branch and new tag
  await remote.push([
    `refs/heads/${versionInfo.releaseBranchName}:refs/heads/${versionInfo.releaseBranchName}`,
    `refs/tags/v${versionInfo.version}:refs/tags/v${versionInfo.version}`,
  ], makeOpts());

  return 'Done!';
}

yargs
  .demandCommand(1, 'You need to provide a cactus command')
  .command('cut', 'cuts a release branch', () => {}, cutReleaseBranch)
  .command('tag', 'tags a version', () => {}, tagVersion)
  .option('upstream', { default: 'origin', describe: 'upstream remote name'})
  .example('git cactus cut', 'Cuts a new release branch (minor)')
  .example('git cactus tag', 'Tags a new version (patch)')
  .argv
