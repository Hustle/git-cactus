# 🌵 git-cactus 🌵

`git-cactus` is a git management tool that supports the [Cactus Branching Model](https://barro.github.io/2016/02/a-succesful-git-branching-model-considered-harmful/).

Build Status: [![CircleCI](https://circleci.com/gh/HustleInc/git-cactus/tree/master.svg?style=shield)](https://circleci.com/gh/HustleInc/git-cactus/tree/master)

## Installation

### Prerequisites
 - Node 8+ for now
 - Working C toolchain (nodegit uses libgit2)
   - On a Mac do `xcode-select --install`

### Procedure

```sh
$ npm install -g git-cactus
```

On Arch Linux, because nodegit's precompiled binary was compiled against an outdated version of libcurl, you must build it from source. See [this nodegit issue](https://github.com/nodegit/nodegit/issues/1225) for details. After running `npm install -g git-cactus`, change to the directory where `git-cactus` was installed and run `BUILD_ONLY=1 npm install nodegit`.

## Usage

`git-cactus` is invoked as a git subcommand like this: `git cactus` (note the space!)

The tool is fairly bare bones to start with. You can only do two things:
 - Cut a release branch
 - Tag a new version

If you want help you can run `git cactus` without any arguments or with the `help` argument.

Warning: Adding a `--help` flag will make git try to open a man page (which doesn't yet exist).

### TLDR

```sh
$ git cactus cut # cuts a release
$ git cactus tag # tags a version
```

### Cutting a Release Branch

Cutting a release branch is used to branch code off of origin's master. Teams typically do
this when they want to make a snapshot of the branch where development happens to do QA
for an upcoming release. This allows collaborative development to continue while the snapshot
of the code is validated for production.

Running the operation is fairly simple:

```sh
$ cd <repository>
$ git cactus cut
```

If the master branch's package.json version is currently v1.2.0 (last release) cutting a release
branch will:

 - Run `npm version minor -m 'Release v%s'` on master
    - bump package.json
    - bump packge.lock
    - commit with message 'Release v1.3.0'
    - tag as v1.3.0
  - Create a new release branch for v1.3 called `release-v1.3`
  - Push changes to `master` branch
  - Push new release branch `release-v1.3`
  - Push tag `v1.3.0`

If you don't use origin as the name of your upstream remote you can specify another:

```
git cactus cut --upstream my-upstream
```

Don't worry about working state! Git cactus will clone the repository you run the command in
to a temporary directory (`/tmp/xxx/`) and run the necessary operations there (including cleanup).

This opinionated but necessary to avoid common errors and frustrations:
 - [Source of Error] Depending on an engineer's local master branch state
 - [Source of Frust] Cutting a release branch interrupts flow by requiring clean git state

### Tagging a Version

Tagging a version is typically done when you want to apply a hotfix to the current release.

To make a hotfix for v1.3.0:
 - Decide where fix needs to go:
   - If the fix applies to current code: make commit on master
   - If the fix applies only to release being patched: do not commit fix to master (doesn't apply)
 - Switch to release branch needing the hotfix
   ```sh
   git checkout release-v1.3 # lets make hotfix for v1.3
   git pull <upstream> release-v1.3
   ```
 - Get the code for the fix onto the branch:
    - If the fix was made to master: `git cherry-pick <fix sha>`
    - If the fix only applies to this release `git apply <fix sha>`
 - Tag the version (v1.3.1)
   ```sh
   git cactus tag
   ```

Tagging a release version will:
 - Running `npm version patch -m 'Release v%s'`
    - bump package.json
    - bump packge.lock
    - commit with message 'Release v1.3.1'
    - tag as v1.3.1
 - Pushing the update release branch `release-v1.3`
 - Pushing tag `v1.3.1`
