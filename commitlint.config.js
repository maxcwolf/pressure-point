// Commit messages follow Conventional Commits: `type: description`, in lowercase.
// Checked as each commit is written (.husky/commit-msg) and again in CI.
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // long lines in the body are fine; the subject line is what has to stay short
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
};
