"""
Unit tests for the model's evaluation helpers.

Training itself is checked by its own output (and by the frontend service
tests, which assert the published figures). What matters here is that the
numbers reported about a model are computed correctly, and that the threshold
is never chosen on the data it is later scored on.
"""

import numpy as np

import train_model as tm


class TestScores:
    def test_confusion_matrix_and_rates(self):
        y = np.array([1, 1, 1, 0, 0, 0, 0, 0])
        probability = np.array([0.9, 0.8, 0.2, 0.7, 0.1, 0.1, 0.05, 0.4])

        result = tm.scores(y, probability, threshold=0.5)
        c = result["confusionMatrix"]

        # Flagged: 0.9, 0.8 (severe) and 0.7 (not).
        assert (c["truePositive"], c["falsePositive"]) == (2, 1)
        assert (c["falseNegative"], c["trueNegative"]) == (1, 4)
        assert result["precision"] == 2 / 3
        assert result["recall"] == 2 / 3
        assert result["f1"] == 2 / 3
        assert result["accuracy"] == 6 / 8
        assert sum(c.values()) == len(y)

    def test_perfect_ranking_scores_one(self):
        y = np.array([0, 0, 1, 1])
        result = tm.scores(y, np.array([0.1, 0.2, 0.8, 0.9]), threshold=0.5)
        assert result["rocAuc"] == 1.0
        assert result["prAuc"] == 1.0

    def test_a_threshold_that_flags_nothing_has_no_recall(self):
        y = np.array([0, 1, 0, 1])
        result = tm.scores(y, np.array([0.1, 0.2, 0.3, 0.4]), threshold=0.99)
        assert result["recall"] == 0.0
        assert result["precision"] == 0.0  # zero_division=0, not a crash


class TestThreshold:
    def test_picks_the_cut_that_maximises_f1(self):
        rng = np.random.default_rng(0)
        probability = rng.uniform(0, 1, 2_000)
        # Severity follows the score, so a mid cut should beat extreme ones.
        y = (rng.uniform(0, 1, 2_000) < probability).astype(int)

        threshold = tm.best_threshold(y, probability)
        chosen = tm.scores(y, probability, threshold)["f1"]

        for other in (0.05, 0.5, 0.95):
            assert chosen >= tm.scores(y, probability, other)["f1"] - 1e-9


class TestCalibration:
    def test_bins_cover_every_row_and_report_both_rates(self):
        rng = np.random.default_rng(1)
        probability = rng.uniform(0, 1, 5_000)
        y = (rng.uniform(0, 1, 5_000) < probability).astype(int)

        bins = tm.calibration(y, probability, bins=10)

        assert sum(b["crashes"] for b in bins) == 5_000
        assert all(0 <= b["predicted"] <= 1 for b in bins)
        # Well-calibrated by construction: predicted should track observed.
        assert all(abs(b["predicted"] - b["observed"]) < 0.1 for b in bins)

    def test_handles_a_constant_prediction(self):
        y = np.array([0, 1, 0, 0])
        bins = tm.calibration(y, np.full(4, 0.25), bins=5)
        assert sum(b["crashes"] for b in bins) == 4
