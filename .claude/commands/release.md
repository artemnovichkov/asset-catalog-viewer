# Release

Create a new release for this VSCode extension.

## Steps

1. **Get last tag**: Run `git describe --tags --abbrev=0` to find the latest tag

2. **Collect changes**: Run `git log <last_tag>..HEAD --oneline` to see all commits since last release

3. **Analyze changes** and determine version bump:
   - **major**: breaking changes (API changes, major rewrites)
   - **minor**: new features (Added section in changelog)
   - **patch**: bug fixes, refactoring, docs

4. **Show changes to user** and ask which version bump to use (patch/minor/major)

5. **Update version**:
   - Update `version` in package.json
   - Add new section to CHANGELOG.md with today's date
   - Categorize commits under Added/Changed/Fixed/Removed

6. **Commit**: `git add -A && git commit -m "Release <new_version>"`

7. **Tag**: `git tag <new_version>`

8. **Push**: `git push && git push --tags`

## Changelog Format

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes in existing functionality

### Fixed
- Bug fixes

### Removed
- Removed features
```

Only include sections that have entries.
