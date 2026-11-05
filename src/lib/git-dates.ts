// src/lib/git-dates.ts
// Resolves article published and modified dates according to Section 6.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export interface ArticleDates {
  published: Date;
  modified?: Date;
  isFuture: boolean;
}

export interface FrontmatterDates {
  published?: Date | string;
  modified?: Date | string;
  minor?: boolean;
}

// In-memory cache to guarantee fast builds
const dateCache = new Map<string, ArticleDates>();

/**
 * Checks if two dates fall on different calendar days (UTC).
 * Returns true if candidateModified is strictly later in calendar days than published.
 */
export function isLaterCalendarDay(published: Date, candidateModified: Date): boolean {
  const pubDay = published.toISOString().slice(0, 10);
  const modDay = candidateModified.toISOString().slice(0, 10);
  return modDay > pubDay;
}

/**
 * Checks if a file content contains `minor: true` in its frontmatter.
 */
export function checkContentIsMinor(content: string): boolean {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) return false;
  return /minor:\s*true/i.test(frontmatterMatch[1]);
}

/**
 * Resolves published and modified dates for a given file:
 * 1. Frontmatter published / modified strictly override git values.
 * 2. Published date = first commit adding file (git log --follow --diff-filter=A).
 * 3. Modified date = latest commit changing file (git log --follow), ignoring commits with `minor: true`.
 * 4. Modified date shown ONLY if its calendar day is strictly later than published day.
 * 5. Falls back to filesystem dates if not tracked in Git.
 * 6. Future-dated articles flagged for hiding.
 */
export function resolveArticleDates(
  filePath: string,
  frontmatter: FrontmatterDates = {},
  cwd: string = process.cwd()
): ArticleDates {
  const cacheKey = `${cwd}:${filePath}:${frontmatter.published}:${frontmatter.modified}:${frontmatter.minor}`;
  if (dateCache.has(cacheKey)) {
    return dateCache.get(cacheKey)!;
  }

  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
  const relativePath = path.relative(cwd, absolutePath).replace(/\\/g, '/');

  let publishedDate: Date | undefined;
  let candidateModifiedDate: Date | undefined;

  // 1. Check frontmatter overrides
  if (frontmatter.published) {
    publishedDate = new Date(frontmatter.published);
  }

  if (frontmatter.modified) {
    candidateModifiedDate = new Date(frontmatter.modified);
  }

  // If both are provided in frontmatter, skip git lookups
  if (!publishedDate || !candidateModifiedDate) {
    try {
      // Get all commits for the file: hash and ISO author date (newest first)
      const logOutput = execFileSync(
        'git',
        ['log', '--follow', '--format=%H|%aI', '--', relativePath],
        {
          cwd,
          stdio: ['ignore', 'pipe', 'ignore'],
        }
      )
        .toString()
        .trim();

      if (logOutput) {
        const commitLines = logOutput.split('\n').filter(Boolean);
        const commits = commitLines.map((line: string) => {
          const [hash, dateStr] = line.split('|');
          return { hash, date: new Date(dateStr) };
        });

        // 2. Resolve Published Date from Git if not overridden
        if (!publishedDate) {
          // Find original commit that added the file
          let addCommitDate: Date | undefined;
          try {
            const addLog = execFileSync(
              'git',
              ['log', '--follow', '--diff-filter=A', '--format=%aI', '--', relativePath],
              { cwd, stdio: ['ignore', 'pipe', 'ignore'] }
            )
              .toString()
              .trim();
            if (addLog) {
              const lines = addLog.split('\n').filter(Boolean);
              addCommitDate = new Date(lines[lines.length - 1]);
            }
          } catch {
            // fallback
          }

          publishedDate = addCommitDate || commits[commits.length - 1].date;
        }

        // 3. Resolve Modified Date from Git if not overridden
        if (!candidateModifiedDate && commits.length > 1) {
          // Iterate from newest commit backwards to find the latest non-minor edit
          for (let i = 0; i < commits.length - 1; i++) {
            const commit = commits[i];
            let isMinor = false;

            // Check if current frontmatter marks the latest state as minor
            if (i === 0 && frontmatter.minor === true) {
              isMinor = true;
            } else {
              try {
                // Inspect file content at this commit
                const fileAtCommit = execFileSync(
                  'git',
                  ['show', `${commit.hash}:${relativePath}`],
                  {
                    cwd,
                    stdio: ['ignore', 'pipe', 'ignore'],
                  }
                ).toString();
                isMinor = checkContentIsMinor(fileAtCommit);
              } catch {
                isMinor = false;
              }
            }

            if (!isMinor) {
              candidateModifiedDate = commit.date;
              break;
            }
          }
        }
      }
    } catch {
      // Git not available or file uncommitted
    }
  }

  // 4. Fallback to filesystem stats if no git history
  if (!publishedDate && fs.existsSync(absolutePath)) {
    const stats = fs.statSync(absolutePath);
    publishedDate = stats.birthtime && stats.birthtime.getTime() > 0 ? stats.birthtime : stats.mtime;
    if (!candidateModifiedDate) {
      candidateModifiedDate = stats.mtime;
    }
  }

  // Default fallback if still undefined
  if (!publishedDate) {
    publishedDate = new Date();
  }

  // 5. Calendar day comparison rule:
  // Modified date is shown ONLY if its calendar day is strictly later than published day
  let finalModifiedDate: Date | undefined = undefined;
  if (candidateModifiedDate && isLaterCalendarDay(publishedDate, candidateModifiedDate)) {
    finalModifiedDate = candidateModifiedDate;
  }

  // 6. Check if published date is in the future
  const now = new Date();
  const isFuture = publishedDate.getTime() > now.getTime();

  const result: ArticleDates = {
    published: publishedDate,
    modified: finalModifiedDate,
    isFuture,
  };

  dateCache.set(cacheKey, result);
  return result;
}

/**
 * Clears date cache (useful for testing and watch mode).
 */
export function clearDateCache(): void {
  dateCache.clear();
}
