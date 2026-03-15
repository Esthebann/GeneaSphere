type AnyId = { toString(): string } | string;

type MemberDoc = {
  _id: AnyId;
  birthDate?: any;
  deathDate?: any;
  unions?: AnyId[];
  parentUnion?: AnyId | null;
};

type UnionDoc = {
  _id: AnyId;
  partners?: AnyId[];
  children?: AnyId[];
  startDate?: any;
};

type LayoutNode = { id: string; type: "MEMBER" | "UNION"; x: number; y: number };

function idStr(x: AnyId | null | undefined) {
  if (!x) return "";
  return typeof x === "string" ? x : x.toString();
}

function toDate(v: any): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function avgDate(dates: (Date | null)[]) {
  const xs = dates.filter(Boolean) as Date[];
  if (!xs.length) return null;
  const t = Math.round(xs.reduce((a, d) => a + d.getTime(), 0) / xs.length);
  return new Date(t);
}

function bucketYear(d: Date, bucket: number) {
  const y = d.getUTCFullYear();
  return Math.floor(y / bucket) * bucket;
}

// Timeline = on calcule un "pivot date" pour MEMBER et UNION
// puis on affecte y en buckets (ex bucket=10 => décennie)
export function applyTimelineY(
  layout: LayoutNode[],
  members: MemberDoc[],
  unions: UnionDoc[],
  bucket: number
): LayoutNode[] {
  const memberById = new Map<string, MemberDoc>();
  for (const m of members) memberById.set(idStr(m._id), m);

  const unionById = new Map<string, UnionDoc>();
  for (const u of unions) unionById.set(idStr(u._id), u);

  const childrenByUnion = new Map<string, string[]>();
  for (const u of unions) {
    childrenByUnion.set(
      idStr(u._id),
      (u.children ?? []).map((c) => idStr(c)).filter(Boolean)
    );
  }

  const unionsByPartner = new Map<string, string[]>();
  for (const u of unions) {
    const uid = idStr(u._id);
    for (const p of u.partners ?? []) {
      const pid = idStr(p);
      if (!pid) continue;
      unionsByPartner.set(pid, [...(unionsByPartner.get(pid) ?? []), uid]);
    }
  }

  function pivotMember(mid: string): Date | null {
    const m = memberById.get(mid);
    if (!m) return null;

    const b = toDate(m.birthDate);
    if (b) return b;

    const d = toDate(m.deathDate);
    if (d) return d;

    const uids = unionsByPartner.get(mid) ?? [];

    const childDates: (Date | null)[] = [];
    for (const uid of uids) {
      const cids = childrenByUnion.get(uid) ?? [];
      for (const cid of cids) {
        const cm = memberById.get(cid);
        if (!cm) continue;
        childDates.push(toDate(cm.birthDate) ?? toDate(cm.deathDate));
      }
    }
    const avgC = avgDate(childDates);
    if (avgC) return avgC;

    const uDates = uids.map((uid) => toDate(unionById.get(uid)?.startDate));
    const avgU = avgDate(uDates);
    if (avgU) return avgU;

    return null;
  }

  function pivotUnion(uid: string): Date | null {
    const u = unionById.get(uid);
    if (!u) return null;

    const s = toDate(u.startDate);
    if (s) return s;

    // guess: moyenne des partenaires +18 ans si birthDate connue
    const partnerDates = (u.partners ?? []).map((p) => {
      const pm = memberById.get(idStr(p));
      const pb = toDate(pm?.birthDate);
      if (!pb) return null;
      const guess = new Date(pb.getTime());
      guess.setUTCFullYear(guess.getUTCFullYear() + 18);
      return guess;
    });
    const avgP = avgDate(partnerDates);
    if (avgP) return avgP;

    const cids = (u.children ?? []).map((c) => idStr(c)).filter(Boolean);
    const cDates = cids.map((cid) => {
      const cm = memberById.get(cid);
      return toDate(cm?.birthDate) ?? toDate(cm?.deathDate);
    });
    const avgC = avgDate(cDates);
    if (avgC) return avgC;

    return null;
  }

  const nodeBucket = new Map<string, number>();

  for (const m of members) {
    const id = idStr(m._id);
    const d = pivotMember(id);
    nodeBucket.set(`M:${id}`, d ? bucketYear(d, bucket) : 1900);
  }

  for (const u of unions) {
    const id = idStr(u._id);
    const d = pivotUnion(id);
    nodeBucket.set(`U:${id}`, d ? bucketYear(d, bucket) : 1900);
  }

  const all = [...nodeBucket.values()];
  const minB = all.length ? Math.min(...all) : 1900;

  const yFromBucket = (by: number) => (by - minB) * 14;

  return layout.map((n) => {
    const key = (n.type === "MEMBER" ? "M:" : "U:") + n.id;
    const by = nodeBucket.get(key) ?? 1900;
    return { ...n, y: yFromBucket(by) };
  });
}
