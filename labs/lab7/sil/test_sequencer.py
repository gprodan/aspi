"""Teste automate (SIL) pentru secvențiatorul rezervorului agitat – aceleași 7 scenarii ca în aplicația web.
Rulare:  python test_sequencer.py        (sau: python -m unittest -v test_sequencer)
Demonstrație de defect:  python test_sequencer.py --s1-tmax 60   → T2 trebuie să pice (preaplin)."""
import sys
import unittest
from sequencer import Sequencer, run

SP, HOLD = 37.0, 20.0
S0, S1, S2, S3, S4, S9 = range(6)
FAULT = S9
P = lambda t, **k: (t, k)
START = [P(1, PB101=1), P(2, PB101=0)]
CFG = {}


def seq():
    return Sequencer(sp=SP, hold=HOLD, **CFG)


class TestSecventiator(unittest.TestCase):
    def test_T1_sarja_normala(self):
        tr = run(START, 220, seq=seq())
        self.assertEqual(tr["visited"], [S0, S1, S2, S3, S4, S0])
        self.assertEqual(tr["final"], S0)
        self.assertGreaterEqual(tr["maxT"], SP)
        self.assertLessEqual(tr["maxT"], SP + 2)
        self.assertLessEqual(tr["L"], 5)
        t3 = [t for t, s in tr["log"] if s == S3][0]
        t4 = [t for t, s in tr["log"] if s == S4][0]
        self.assertGreaterEqual(t4 - t3, HOLD - 0.5)

    def test_T2_lsh_blocat(self):
        tr = run(START, 120, faults={"lshStuck": True}, seq=seq())
        self.assertEqual(tr["final"], FAULT)
        self.assertFalse(tr["out"]["XV101"])
        self.assertLess(tr["L"], 99.9, "preaplin: timeout prea lung")

    def test_T3_oprire_urgenta_in_incalzire(self):
        tr = run(START + [P(30, ES101=1)], 50, seq=seq())
        self.assertEqual(tr["final"], FAULT)
        for k in ("XV101", "XV102", "M101", "EH101"):
            self.assertFalse(tr["out"][k], k)

    def test_T4_tt_inghetat(self):
        tr = run(START + [P(5, ttFrozen=True)], 200, seq=seq())
        self.assertEqual(tr["final"], FAULT)
        self.assertFalse(tr["out"]["EH101"])
        self.assertLessEqual(tr["maxT"], 60)

    def test_T5_repornire_interzisa_din_avarie(self):
        ev = [P(0.5, ES101=1), P(5, ES101=0), P(8, PB101=1), P(9, PB101=0), P(20, PB102=1), P(21, PB102=0)]
        tr = run(ev, 40, seq=seq())
        at15 = [s for t, s, *_ in tr["samples"] if t >= 15][0]
        self.assertEqual(at15, FAULT)
        self.assertEqual(tr["final"], S0)

    def test_T6_oprire_controlata(self):
        tr = run(START + [P(55, PB102=1), P(56, PB102=0)], 140, seq=seq())
        self.assertNotIn(FAULT, tr["visited"])
        self.assertIn(S4, tr["visited"])
        self.assertEqual(tr["final"], S0)

    def test_T7_interblocare_incalzitor(self):
        tr = run(START, 220, seq=seq())
        self.assertEqual(tr["inv"], [], "EH101 activ fără agitator sau fără lichid")


if __name__ == "__main__":
    a = sys.argv[1:]
    if "--s1-tmax" in a:
        i = a.index("--s1-tmax")
        CFG["s1_tmax"] = float(a[i + 1])
        del a[i:i + 2]
    unittest.main(argv=[sys.argv[0], "-v"] + a)
