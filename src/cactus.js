const tmp = require('tmp');
const util = require('util');
const cp = require('child_process');
const yargs = require('yargs');
const logger = require('winston');
const inquirer = require('inquirer');
const semver = require('semver');
const SimpleGit = require('simple-git/promise');

// Enable pretty CLI logging
logger.cli();

// HACK: this depends on the project being a NodeJS project
// TODO: improve by allowing user to point you to file containing version info
function getVersion(repoPath) {
  if (!repoPath) {
    repoPath = process.cwd();
  }
  const pkg = require(`${repoPath}/package.json`);
  return pkg.version;
}

// Generates the next release version given the curent version and the next level
// Level can be 'major' or 'minor'
function generateNextVersion(currentVersion, level) {
  const version = semver.inc(currentVersion, level);
  const minorVer = `${semver.major(version)}.${semver.minor(version)}`;
  const releaseBranchName = `release-v${minorVer}`;
  return { version, minorVer, releaseBranchName };
}

async function approveDiff(repo, currentVersion, endRange) {
  const range = `v${currentVersion}..${endRange}`;
  const commits = await repo.log([range]);

  const message = [
    `--- START COMMIT LOG ${range} ---`,
    ...commits.all.map(({date, author_name, message}) => `[${date}] (${author_name}) ${message}`),
    `--- END COMMIT LOG ${range} ---`
  ].join('\n');

  console.log(message);

  return await inquirer.prompt([
    {
      type: 'confirm',
      name: 'lgtm',
      message: `Does the commit log look good?`,
      default: false,
    }
  ]);
}

async function cutReleaseBranch(args) {
  // Get upstream remote for current repo
  const repo = SimpleGit();
  const url = (await repo.remote(['get-url', args.upstream])).trim();

  // Create tempdir and clone fresh copy
  const tmpdir = tmp.dirSync({ unsafeCleanup: true });

  // Clone a fresh copy of the repository
  await repo.clone(url, tmpdir.name);
  const clonedRepo = SimpleGit(tmpdir.name);

  // Determine new version and branch names
  const currentVersion = getVersion(tmpdir.name);
  const versionInfo = generateNextVersion(currentVersion, args.level);

  // Ask for approval on diff before cutting
  logger.info('Cutting branch', versionInfo.releaseBranchName);
  const approval = await approveDiff(repo, currentVersion, args.master);

  // Shell out to run npm version inside tempdir
  cp.execSync(`npm version ${args.level} -m "Release v%s"`, { cwd: tmpdir.name });

  if (!approval.lgtm) {
    return 'Aborted branch cut! Phew, that was a close one...';
  }

  // Push master, the release branch, and tag
  logger.info(`Pushing branch ${versionInfo.releaseBranchName} & tag v${versionInfo.version}`);

  // the remote used for the initial clone of a git repo is named origin. As far
  // as I know, there isn't a way to change that
  await clonedRepo.push('origin', args.master);
  await clonedRepo.push('origin', `${args.master}:${versionInfo.releaseBranchName}`);
  await clonedRepo.pushTags('origin');
  // Note that this is the original repo, not the cloned repo
  await repo.pull(args.upstream, { '--rebase': null });

  return 'Done!';
}

async function tagVersion(args) {
  // Get upstream remote for current repo
  const repo = SimpleGit();
  const remote = (await repo.remote(['get-url', args.upstream])).trim();

  // Determine the next tag for this release branch (patch)
  const currentVersion = getVersion();
  const versionInfo = generateNextVersion(currentVersion, 'patch');

  // Ask for approval on diff before pushing
  logger.info('Tagging version', versionInfo.version);
  const approval = await approveDiff(repo, currentVersion, 'HEAD');

  if (!approval.lgtm) {
    return 'Aborted push! Local changes reverted, you must now do surgery!';
  }

  // Shell out to run npm version
  cp.execSync('npm version patch -m "Release v%s"');

  // Push updated release branch and new tag
  logger.info('Pushing tagged version', versionInfo.version);

  await repo.push(args.upstream, versionInfo.releaseBranchName),
  await repo.pushTags(args.upstream)

  return 'Done!';
}

// Exported for testing
module.exports = {
  generateNextVersion,
  cutReleaseBranch,
  tagVersion,
}
