"""Gemenul digital al rezervorului agitat și secvențiatorul (portare 1:1 a modelului GRAFCET implicit).

Instalația (aceleași ecuații ca în aplicația web, lucrarea 7):
  nivel   L' = 4·XV101 − 6·XV102                      [%/s]
  temper. T' = (încălzire·amestec − 0,012·(T − 20))   [°C/s],  încălzire = 60/(L+15) dacă EH101 și L > 1
          amestec = 1 cu agitator, 0,55 fără
"""

OUTS = ("XV101", "XV102", "M101", "EH101", "HL101")


class Plant:
    def __init__(self):
        self.L = 0.0
        self.T = 20.0
        self.Tamb = 20.0

    def step(self, dt, o):
        self.L += (4.0 if o["XV101"] else 0.0) * dt - (6.0 if o["XV102"] else 0.0) * dt
        self.L = max(0.0, min(100.0, self.L))
        heat = 60.0 / (self.L + 15.0) if (o["EH101"] and self.L > 1.0) else 0.0
        mix = 1.0 if o["M101"] else 0.55
        self.T += (heat * mix - 0.012 * (self.T - self.Tamb)) * dt


class Sequencer:
    """Pașii: 0 Repaus, 1 Umplere, 2 Încălzire, 3 Menținere, 4 Golire, 5 Avarie."""
    NAMES = ["S0", "S1", "S2", "S3", "S4", "S9"]

    def __init__(self, sp=37.0, hold=20.0, s1_tmax=24.0, s2_tmax=60.0, s4_tmax=60.0):
        self.sp, self.hold = sp, hold
        self.tmax = {1: s1_tmax, 2: s2_tmax, 4: s4_tmax}
        self.step = 0
        self.t = 0.0
        self.out = {k: False for k in OUTS}

    def scan(self, i, dt):
        """i: dict cu PB101, PB102, ES101, LSL101, LSH101, TT101. Un ciclu de scanare."""
        nxt = self.step
        if i["ES101"] and self.step != 5:                      # tranziție globală
            nxt = 5
        else:
            s, t = self.step, self.t
            if s == 0 and i["PB101"] and not i["LSL101"]:
                nxt = 1
            elif s == 1:
                if i["LSH101"]: nxt = 2
                elif i["PB102"]: nxt = 4
                elif t > self.tmax[1]: nxt = 5
            elif s == 2:
                if i["TT101"] >= self.sp: nxt = 3
                elif i["PB102"]: nxt = 4
                elif t > self.tmax[2]: nxt = 5
            elif s == 3:
                if t >= self.hold or i["PB102"]: nxt = 4
            elif s == 4:
                if not i["LSL101"]: nxt = 0
                elif t > self.tmax[4]: nxt = 5
            elif s == 5 and i["PB102"] and not i["ES101"]:
                nxt = 0
        changed = nxt != self.step
        if changed:
            self.step, self.t = nxt, 0.0
        o = {k: False for k in OUTS}
        s = self.step
        if s == 1: o["XV101"] = True
        elif s == 2: o["M101"] = True; o["EH101"] = i["TT101"] < self.sp
        elif s == 3: o["M101"] = True; o["EH101"] = i["TT101"] < self.sp - 0.5
        elif s == 4: o["XV102"] = True; o["M101"] = True
        elif s == 5: o["HL101"] = True
        self.out = o
        self.t += dt
        return changed


def run(events, duration, faults=None, seq=None, dt=0.1):
    """Rulează un scenariu. events: listă de (t, {nume: valoare}); faults: {lshStuck, lslStuck, ttFrozen}.
    Returnează un dicționar cu urma: pași vizitați, jurnal, temperatură maximă, stare finală, încălcări de interblocare."""
    seq = seq or Sequencer()
    p, f = Plant(), dict(faults or {})
    btn = {"PB101": False, "PB102": False, "ES101": False}
    pend = sorted(events, key=lambda e: e[0])
    frozen = None
    tr = {"visited": [0], "log": [], "maxT": 0.0, "inv": [], "samples": []}
    time = 0.0
    for k in range(int(round(duration / dt))):
        while pend and time >= pend[0][0] - 1e-9:
            _, d = pend.pop(0)
            for key, v in d.items():
                if key in btn: btn[key] = bool(v)
                else: f[key] = v
        i = dict(btn)
        i["LSL101"] = True if f.get("lslStuck") else p.L > 5
        i["LSH101"] = False if f.get("lshStuck") else p.L >= 90
        if f.get("ttFrozen"):
            frozen = p.T if frozen is None else frozen
            i["TT101"] = frozen
        else:
            frozen = None
            i["TT101"] = p.T
        if seq.scan(i, dt):
            tr["visited"].append(seq.step)
            tr["log"].append((time, seq.step))
        p.step(dt, seq.out)
        tr["maxT"] = max(tr["maxT"], p.T)
        if seq.out["EH101"] and (not seq.out["M101"] or not i["LSL101"]):
            tr["inv"].append(time)
        if k % 10 == 0:
            tr["samples"].append((time, seq.step, p.L, p.T))
        time += dt
    tr.update(final=seq.step, L=p.L, T=p.T, out=dict(seq.out))
    return tr
