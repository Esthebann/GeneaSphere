import { NextRequest } from "next/server";
import { connectDb } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { Member } from "@/models/Member";
import { Union } from "@/models/Union";
import { jsonOk, jsonError } from "@/lib/http";
import { applyTimelineY } from "@/lib/timelineLayout";

/**
 * Un nœud de layout envoyé au front:
 * - id: id Mongo stringifié
 * - type: MEMBER ou UNION
 * - x,y: position (souvent centre) dans l’espace du SVG
 */
type LayoutNode = { id: string; type: "MEMBER" | "UNION"; x: number; y: number };

/**
 * Prend une valeur censée être une date (Date|string|etc)
 * - null si vide ou invalide
 * - sinon renvoie l’année (UTC)
 */
function yearFromBirthDate(v: any): number | null {
  if (!v) return null;                 // rien => pas d’année
  const d = new Date(v);               // tentative de parsing
  if (Number.isNaN(d.getTime())) return null; // invalide => null
  return d.getUTCFullYear();           // année (UTC)
}

/**
 * "Bucket" = regrouper des années par tranches de N années.
 * Exemple bucket=10:
 * 1994 -> floor(1994/10)=199 (index de décennie)
 */
function bucketYear(y: number, bucket: number) {
  return Math.floor(y / bucket);
}

/** clamp: borne n entre a et b */
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/**
 * Handler GET de la route API.
 * Query params attendus:
 * - mode=generation|timeline
 * - bucket=10 (tranche en années en timeline)
 */
export async function GET(req: NextRequest) {
  // ===================== 1) AUTH =====================
  const auth = await requireAuth(req);            // vérifie token/cookie/etc
  if (!auth.ok) return jsonError(auth.error, auth.status); // si KO => réponse erreur

  // ===================== 2) PARAMS URL =====================
  const url = new URL(req.url); // parse l’URL pour lire ?mode=...&bucket=...

  // mode: "generation" par défaut, sinon "timeline"
  const mode = (url.searchParams.get("mode") ?? "generation") as
      | "generation"
      | "timeline";

  // bucket: parseInt + fallback 10 + clamp 1..50
  // - parseInt(...) => nombre
  // - || 10 => si NaN/0 => 10
  // - clamp => garantit [1..50]
  const bucket = clamp(parseInt(url.searchParams.get("bucket") ?? "10", 10) || 10, 1, 50);

  // ===================== 3) DB =====================
  await connectDb(); // ouvre la connexion Mongo

  // charge tous les membres / unions (lean = objets JS simples)
  const members = await Member.find({ treeId: auth.user.treeId }).lean();
  const unions = await Union.find({ treeId: auth.user.treeId }).lean();

  // ===================== 4) FILTRAGE PERMISSIONS =====================
  // Règle:
  // - PUBLIC => visible
  // - ADMIN => visible
  // - sinon => visible seulement si createdBy == auth.user.userId
  const visibleMembers = members.filter((m: any) => {
    if (m.visibility === "PUBLIC") return true;
    if (auth.user.role === "ADMIN") return true;
    return m.createdBy?.toString() === auth.user.userId;
  });

  // Set des ids de membres visibles (pour filtrer unions)
  const memberIds = new Set(visibleMembers.map((m: any) => m._id.toString()));

  // Union visible si:
  // - au moins un partner visible OU au moins un child visible
  const visibleUnions = unions.filter((u: any) => {
    const partners = (u.partners ?? []).map((x: any) => x.toString());
    const children = (u.children ?? []).map((x: any) => x.toString());
    return (
        partners.some((id: string) => memberIds.has(id)) ||
        children.some((id: string) => memberIds.has(id))
    );
  });

  // ===================== 5) LAYOUT "GENERATION" (fallback) =====================
  // Espacement vertical/horizontal du layout
  const Y_STEP = 180; // distance entre générations
  const X_STEP = 220; // distance entre membres sur une même ligne

  // Maps id->objet (pour accès rapide)
  const byIdMember = new Map<string, any>();
  for (const m of visibleMembers) byIdMember.set(m._id.toString(), m);

  const byIdUnion = new Map<string, any>();
  for (const u of visibleUnions) byIdUnion.set(u._id.toString(), u);

  // ---------- 5.1) calcul de génération (depth) ----------
  // genCache = mémorise génération calculée pour éviter recalcul
  const genCache = new Map<string, number>();

  /**
   * genMember(id) renvoie:
   * - 0 si pas de parentUnion ou si parentUnion introuvable
   * - sinon = max(gen(parents)) + 1
   *
   * guard = anti-boucle (cycle) : si on retombe sur un id déjà en cours, on stoppe.
   */
  function genMember(id: string, guard = new Set<string>()): number {
    if (genCache.has(id)) return genCache.get(id)!; // déjà calculé

    if (guard.has(id)) return 0; // cycle détecté => fallback 0
    guard.add(id);

    const m = byIdMember.get(id); // récup membre
    const pu = m?.parentUnion ? m.parentUnion.toString() : null; // union des parents

    if (!pu) {
      genCache.set(id, 0); // pas de parents => génération 0
      return 0;
    }

    const u = byIdUnion.get(pu); // récup union parentale (si visible)
    if (!u) {
      genCache.set(id, 0); // union parentale non visible => génération 0
      return 0;
    }

    // parents = partners de l’union parentale, mais seulement ceux visibles
    const partners = (u.partners ?? [])
        .map((x: any) => x.toString())
        .filter((pid: string) => byIdMember.has(pid));

    if (partners.length === 0) {
      genCache.set(id, 1); // parents non visibles => on met l’enfant au niveau 1
      return 1;
    }

    // génération = 1 + max(génération des parents)
    const pg = Math.max(...partners.map((pid: string) => genMember(pid, guard)));
    const g = pg + 1;

    genCache.set(id, g);
    return g;
  }

  // ---------- 5.2) tri stable des membres (pour placement X) ----------
  // Tri par:
  // 1) génération
  // 2) lastName
  // 3) firstName
  const sortedMembers = [...visibleMembers].sort((a: any, b: any) => {
    const ga = genMember(a._id.toString());
    const gb = genMember(b._id.toString());
    if (ga !== gb) return ga - gb;

    const la = String(a.lastName ?? "");
    const lb = String(b.lastName ?? "");
    if (la !== lb) return la.localeCompare(lb);

    return String(a.firstName ?? "").localeCompare(String(b.firstName ?? ""));
  });

  // layout = résultat final
  const layout: LayoutNode[] = [];

  // posMember = positions des membres, utile pour positionner les unions
  const posMember = new Map<string, { x: number; y: number }>();

  // rowCount[g] = combien de membres déjà posés sur la ligne g
  const rowCount = new Map<number, number>();

  // ---------- 5.3) placement des MEMBERS ----------
  for (const m of sortedMembers) {
    const id = m._id.toString();
    const g = genMember(id);          // génération (Y)

    const idx = rowCount.get(g) ?? 0; // index dans la rangée g
    rowCount.set(g, idx + 1);

    const x = 70 + idx * X_STEP;      // x en colonne
    const y = g * Y_STEP;             // y selon génération

    posMember.set(id, { x, y });      // mémorise
    layout.push({ id, type: "MEMBER", x, y }); // ajoute au layout
  }

  // ---------- 5.4) placement des UNIONS ----------
  // - x = moyenne des partners visibles (sinon moyenne enfants visibles)
  // - y = "entre niveaux" => g * Y_STEP + Y_STEP/2
  for (const u of visibleUnions) {
    const uid = u._id.toString();

    const partners = (u.partners ?? [])
        .map((x: any) => x.toString())
        .filter((pid: string) => posMember.has(pid)); // seulement si partner a une position

    const children = (u.children ?? [])
        .map((x: any) => x.toString())
        .filter((cid: string) => posMember.has(cid)); // seulement si child a une position

    // x par défaut
    let x = 70;

    // si on a des partners visibles => centre = moyenne X partners
    if (partners.length > 0) {
      x = Math.round(
          partners.reduce((s: number, pid: string) => s + posMember.get(pid)!.x, 0) /
          partners.length
      );
    }
    // sinon centre = moyenne X enfants
    else if (children.length > 0) {
      x = Math.round(
          children.reduce((s: number, cid: string) => s + posMember.get(cid)!.x, 0) /
          children.length
      );
    }

    // calcul g (niveau) pour placer l’union verticalement
    let g = 0;
    if (partners.length > 0) g = Math.max(...partners.map((pid: string) => genMember(pid)));
    else if (children.length > 0) g = Math.max(...children.map((cid: string) => genMember(cid) - 1));

    const y = g * Y_STEP + Math.round(Y_STEP / 2);

    layout.push({ id: uid, type: "UNION", x, y });
  }

  // ===================== 6) MODE TIMELINE (modifie Y, puis X des MEMBERS) =====================
  if (mode === "timeline") {
    // ---------- 6.1) trouver l’origine minB ----------
    // years = liste des buckets d’années de naissance existantes
    const years: number[] = [];
    for (const m of visibleMembers) {
      const y = yearFromBirthDate(m.birthDate);
      if (y !== null) years.push(bucketYear(y, bucket));
    }

    // minB = plus ancien bucket => servira de y=0
    const minB = years.length ? Math.min(...years) : 0;

    // ---------- 6.2) construire memberY (id -> y timeline) ----------
    const memberY = new Map<string, number>();

    for (const m of visibleMembers) {
      const id = m._id.toString();

      // y0 = fallback: la position génération si pas de birthDate
      const y0 = posMember.get(id)?.y ?? 0;

      const y = yearFromBirthDate(m.birthDate);
      if (y === null) {
        memberY.set(id, y0); // pas de date => garde y génération
      } else {
        const b = bucketYear(y, bucket);         // bucket de l’année
        memberY.set(id, (b - minB) * Y_STEP);    // y relatif à l’origine
      }
    }

    // ---------- 6.3) appliquer Y timeline aux MEMBERS dans layout ----------
    for (const n of layout) {
      if (n.type === "MEMBER") n.y = memberY.get(n.id) ?? n.y;
    }

    // ---------- 6.4) appliquer Y timeline aux UNIONS ----------
    // y union = moyenne des y des partners + children + offset
    for (const n of layout) {
      if (n.type !== "UNION") continue;

      const u = byIdUnion.get(n.id);
      if (!u) continue;

      const partners = (u.partners ?? [])
          .map((x: any) => x.toString())
          .filter((pid: string) => memberY.has(pid));

      const children = (u.children ?? [])
          .map((x: any) => x.toString())
          .filter((cid: string) => memberY.has(cid));

      const ys: number[] = [];
      for (const pid of partners) ys.push(memberY.get(pid)!);
      for (const cid of children) ys.push(memberY.get(cid)!);

      if (ys.length === 0) continue;

      const base = ys.reduce((a, b) => a + b, 0) / ys.length;
      n.y = Math.round(base + Y_STEP / 2);
    }

    // ---------- 6.5) (NOUVEAU) réassignation X par bande Y ----------
    // But: si beaucoup de gens tombent dans la même tranche (même Y),
    // on les repositionne en colonnes (70 + k*220) pour éviter overlap.
    const byY = new Map<number, string[]>();

    // groupe uniquement les MEMBERS par leur y (timeline)
    for (const n of layout) {
      if (n.type !== "MEMBER") continue;
      const arr = byY.get(n.y) ?? [];
      arr.push(n.id);
      byY.set(n.y, arr);
    }

    // pour chaque bande yy:
    for (const [yy, ids] of byY.entries()) {
      // tri alphabétique à l’intérieur de la bande (stabilité)
      ids.sort((a, b) => {
        const ma = byIdMember.get(a);
        const mb = byIdMember.get(b);
        const la = String(ma?.lastName ?? "");
        const lb = String(mb?.lastName ?? "");
        if (la !== lb) return la.localeCompare(lb);
        return String(ma?.firstName ?? "").localeCompare(String(mb?.firstName ?? ""));
      });

      // placement X en colonnes
      for (let k = 0; k < ids.length; k++) {
        const id = ids[k];

        // retrouve le LayoutNode membre correspondant (⚠️ O(n) à chaque fois)
        const node = layout.find((n) => n.type === "MEMBER" && n.id === id);

        // met à jour x = 70 + k*220 (même logique que X_STEP)
        if (node) node.x = 70 + k * 220;
      }
    }
  }

  // ===================== 7) REPONSE JSON =====================
  // Sérialise:
  // - _id ObjectId -> string
  // - dates -> ISO string
  return jsonOk({
    members: visibleMembers.map((m: any) => ({
      id: m._id.toString(),
      firstName: m.firstName,
      lastName: m.lastName,
      sex: m.sex,
      visibility: m.visibility,
      createdBy: m.createdBy?.toString(),
      unions: (m.unions ?? []).map((x: any) => x.toString()),
      parentUnion: m.parentUnion ? m.parentUnion.toString() : null,
      birthDate: m.birthDate ? new Date(m.birthDate).toISOString() : null,
      deathDate: m.deathDate ? new Date(m.deathDate).toISOString() : null,
      version: m.version,
    })),
    unions: visibleUnions.map((u: any) => ({
      id: u._id.toString(),
      partners: (u.partners ?? []).map((x: any) => x.toString()),
      children: (u.children ?? []).map((x: any) => x.toString()),
      status: u.status,
      startDate: u.startDate ? new Date(u.startDate).toISOString() : null,
      endDate: u.endDate ? new Date(u.endDate).toISOString() : null,
      version: u.version,
    })),
    layout,  // << les positions calculées
    mode,    // << echo du param mode
    bucket,  // << echo du param bucket
  });
}