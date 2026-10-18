import unittest
from unittest.mock import patch
from changes import changed_paths, classify
import subprocess


class ChangeDetectionTests(unittest.TestCase):
    def test_component_changes(self):
        self.assertEqual(classify(['backend/src/main.ts']), {'backend': True, 'frontend': False, 'environment': True})
        self.assertEqual(classify(['frontend/package-lock.json']), {'backend': False, 'frontend': True, 'environment': True})

    def test_docs_only(self):
        self.assertFalse(any(classify(['README.md', 'backend/docs/architecture.md', 'frontend/.gitkeep']).values()))

    def test_shared_changes(self):
        for path in ['.github/workflows/ci.yml', '.nvmrc', 'scripts/ci/changes.py', 'packages/shared/index.ts']:
            self.assertTrue(all(classify([path]).values()))

    def test_manual_and_new_branch_check_everything(self):
        self.assertIsNone(changed_paths('workflow_dispatch', {}))
        self.assertIsNone(changed_paths('push', {'before': '0' * 40, 'after': 'abc'}))

    @patch('changes.subprocess.run')
    def test_pr_uses_merge_base_and_preserves_deleted_paths(self, run):
        run.return_value.stdout = b'backend/deleted.ts\0frontend/new.ts\0'
        paths = changed_paths('pull_request', {'pull_request': {'base': {'sha': 'abc'}, 'head': {'sha': 'def'}}})
        self.assertTrue(all(classify(paths).values()))
        self.assertEqual(run.call_args.args[0], ['git', 'diff', '--name-only', '--no-renames', '-z', 'abc...def', '--'])

    @patch('changes.subprocess.run')
    def test_dev_push_compares_before_and_after(self, run):
        run.return_value.stdout = b'frontend/src/app/page.tsx\0'
        changed_paths('push', {'before': 'abc', 'after': 'def'})
        self.assertIn('abc..def', run.call_args.args[0])

    @patch('changes.subprocess.run', side_effect=subprocess.CalledProcessError(1, 'git'))
    def test_missing_history_checks_everything(self, run):
        self.assertIsNone(changed_paths('push', {'before': 'abc', 'after': 'def'}))


if __name__ == '__main__':
    unittest.main()
