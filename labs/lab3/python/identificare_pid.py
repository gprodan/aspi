"""Identificarea unui proces FOPDT din răspunsul la treaptă și acordarea regulatoarelor (lucrarea 3).

Rulare:  python identificare_pid.py [--sigma 0.5] [--K 1.5 --T 40 --L 6]
Pași: (1) simulare buclă deschisă, (2) estimare K, T, L prin metoda celor două puncte (t28,3 și t63,2),
(3) acordare Ziegler–Nichols (buclă deschisă) și IMC, (4) simulare în buclă închisă și metrici.
Aceleași ecuații ca în aplicația web (fila 3). Doar biblioteca standard."""
import argparse
import math
import random

DT = 0.1


def simulate(K, T, L, ctrl, tend=600, sigma=0.0, seed=4242, openloop_du=None):
    """ctrl: dict(mode, kp, ti, td, umax, aw, sp2, dist) sau None pentru buclă deschisă."""
    rnd = random.Random(seed)
    n = int(round(tend / DT))
    buf = [0.0] * (int(round(L / DT)) + 1)
    y = I = dF = 0.0
    prev = None
    ts, sps, ys, yms, us = [], [], [], [], []
    for k in range(n):
        t = k * DT
        ym = y + (rnd.gauss(0, sigma) if sigma else 0.0)
        if prev is None:
            prev = ym
        if openloop_du is not None:
            sp, u = 0.0, (0.0 if t < 10 else openloop_du)
        else:
            sp = 0.0 if t < 10 else (50.0 if t < 300 else ctrl["sp2"])
            e = sp - ym
            kp, ti, td, umax = ctrl["kp"], ctrl["ti"], ctrl["td"], ctrl.get("umax", 100.0)
            D = 0.0
            if ctrl["mode"] == "PID" and td > 0:
                al = DT / (td / 10 + DT)
                dF += al * (-kp * td * (ym - prev) / DT - dF)
                D = dF
            inc = kp * e * DT / ti if ti > 0 else 0.0
            un = kp * e + I + D
            if not (ctrl.get("aw", True) and ((un >= umax and inc > 0) or (un <= 0 and inc < 0))):
                I += inc
            u = min(umax, max(0.0, kp * e + I + D))
        prev = ym
        buf.append(u)
        ud = buf.pop(0)
        d = ctrl["dist"] if (ctrl and t >= 500) else 0.0
        y += ((K * (ud + d) - y) / T) * DT
        ts.append(t); sps.append(sp); ys.append(y); yms.append(ym); us.append(u)
    return ts, sps, ys, yms, us


def identify(K, T, L, du=20.0, sigma=0.0):
    tend = max(150, int(8 * T + L + 40))
    ts, _, _, ym, _ = simulate(K, T, L, None, tend=tend, sigma=sigma, openloop_du=du)
    n = len(ts)
    sm = [sum(ym[max(0, i - 5):min(n, i + 6)]) / len(ym[max(0, i - 5):min(n, i + 6)]) for i in range(n)]
    y0 = sm[50]
    yf = sum(sm[-100:]) / 100
    dy = yf - y0

    def cross(f):
        tg = y0 + f * dy
        for i in range(100, n):
            if sm[i] >= tg:
                return ts[i] - 10
        return float("nan")

    t28, t63 = cross(0.283), cross(0.632)
    T_e = 1.5 * (t63 - t28)
    return dy / du, T_e, t63 - T_e


def metrics(K, T, L, ctrl, sigma=0.0):
    ts, sp, y, _, _ = simulate(K, T, L, ctrl, sigma=sigma)
    i0, i1 = 100, 3000
    os_ = max(0.0, (max(y[i0:i1]) - 50) / 50 * 100)
    last = i0
    for i in range(i0, i1):
        if abs(y[i] - 50) > 1:
            last = i
    tst = float("nan") if last >= i1 - 1 else ts[last] - 10
    iae = sum(abs(sp[i] - y[i]) * DT for i in range(i0, i1))
    dev = max(abs(v - ctrl["sp2"]) for v in y[5000:])
    return os_, tst, iae, dev


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--K", type=float, default=1.5)
    ap.add_argument("--T", type=float, default=40.0)
    ap.add_argument("--L", type=float, default=6.0)
    ap.add_argument("--sigma", type=float, default=0.0)
    a = ap.parse_args()
    Ke, Te, Le = identify(a.K, a.T, a.L, sigma=a.sigma)
    print("Proces real:      K = %.2f  T = %.1f s  L = %.1f s" % (a.K, a.T, a.L))
    print("Proces estimat:   K = %.2f  T = %.1f s  L = %.1f s  (σ zgomot = %.1f)\n" % (Ke, Te, Le, a.sigma))
    L2 = max(0.5, Le)
    sets = {
        "ZN-PI": dict(mode="PI", kp=0.9 * Te / (Ke * L2), ti=3.33 * L2, td=0.0),
        "ZN-PID": dict(mode="PID", kp=1.2 * Te / (Ke * L2), ti=2 * L2, td=0.5 * L2),
        "IMC-PI (λ=L)": dict(mode="PI", kp=Te / (Ke * 2 * L2), ti=Te, td=0.0),
    }
    print("%-14s %7s %7s %6s | %9s %9s %8s %9s" % ("metoda", "Kp", "Ti", "Td", "depășire%", "stabil[s]", "IAE", "abat.pert"))
    for name, c in sets.items():
        c.update(umax=100.0, aw=True, sp2=70.0, dist=-10.0)
        os_, tst, iae, dev = metrics(a.K, a.T, a.L, c, a.sigma)
        print("%-14s %7.2f %7.1f %6.1f | %9.1f %9.0f %8.0f %9.1f" % (name, c["kp"], c["ti"], c["td"], os_, tst, iae, dev))


if __name__ == "__main__":
    main()
