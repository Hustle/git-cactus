const { generateNextVersion } = require('../src/cactus');

describe('generateNextVersion', function() {
  describe('major version', function() {
    it('produces major version bump', function() {
      const nextVersion = generateNextVersion('v1.2.3', 'major');
      expect(nextVersion.releaseBranchName).toBe('release-v2.0');
      expect(nextVersion.minorVer).toBe('2.0');
      expect(nextVersion.version).toBe('2.0.0');
    });
  });

  describe('minor version', function() {
    it('produces minor version bump', function() {
      const nextVersion = generateNextVersion('v1.2.3', 'minor');
      expect(nextVersion.releaseBranchName).toBe('release-v1.3');
      expect(nextVersion.minorVer).toBe('1.3');
      expect(nextVersion.version).toBe('1.3.0');
    });
  });
});
