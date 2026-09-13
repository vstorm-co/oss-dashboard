import unittest
from unittest.mock import patch
from scripts.collect import merge_days, pages

class CollectionTests(unittest.TestCase):
    def test_preserves_history_and_replaces_revised_days(self):
        self.assertEqual(merge_days({'2025-01-01': 10, '2026-01-01': 3}, {'2026-01-01': 4}), {'2025-01-01': 10, '2026-01-01': 4})

    @patch('scripts.collect.request')
    def test_paginates_even_at_exact_page_boundary(self, request):
        request.side_effect = [[{'id': i} for i in range(100)], []]
        self.assertEqual(len(pages('orgs/example/repos?type=public')), 100)
        self.assertIn('&per_page=100&page=2', request.call_args.args[0])

    @patch('scripts.collect.request')
    def test_failed_page_never_returns_partial_results(self, request):
        request.side_effect = [[{}] * 100, RuntimeError('unavailable')]
        with self.assertRaises(RuntimeError):
            pages('repos/example/test/issues')
