/**
 * Représente une personne (nœud "MEMBER").
 * - id: identifiant unique
 * - unions: liste des unions (mariages/relations) auxquelles cette personne participe
 *   (⚠️ dans CE code, ce champ n'est pas utilisé : on reconstruit l'info via unions[].partners)
 * - parentUnion: l'union dont cette personne est issue (ses parents / union parentale),
 *   ou null si c'est une "racine" (ancêtre le plus haut dans le graphe).
 */
type Member = {
  id: string;
  unions: string[];
  parentUnion: string | null;
};

/**
 * Représente une union (nœud "UNION").
 * - id: identifiant unique
 * - partners: ids des membres partenaires (souvent 2, mais peut être n)
 * - children: ids des membres enfants issus de cette union
 */
type Union = {
  id: string;
  partners: string[];
  children: string[];
};

/**
 * Sortie: positions (x,y) de chaque nœud à afficher dans un layout 2D.
 * type:
 *  - MEMBER : boîte "personne"
 *  - UNION  : boîte "union" (souvent placée entre partenaires et enfants)
 *
 * Convention:
 * - x = centre horizontal (pas le bord gauche)
 * - y = coordonnée verticale (niveau/génération)
 */
export type LayoutNode = {
  id: string;
  type: "MEMBER" | "UNION";
  x: number;
  y: number;
};

/**
 * Entrée: liste complète des membres et unions.
 */
type Input = {
  members: Member[];
  unions: Union[];
};

/** Largeur "minimum" d'une boîte membre */
const MEMBER_W = 140;
/** Largeur "minimum" d'une boîte union */
const UNION_W = 80;
/** Espacement horizontal entre siblings (membres ou unions) */
const H_GAP = 40;
/** Espacement vertical entre générations (levels) */
const LEVEL_Y = 180;
/** Décalage vertical pour placer les unions entre niveau parents et enfants */
const UNION_Y_OFFSET = 90;

/**
 * computeLayout :
 * Calcule un layout en "arbre de descendance" (top-down).
 *
 * Idée générale:
 * 1) Construire des index (maps) pour accéder vite aux membres/unions.
 * 2) Calculer une profondeur (génération) pour chaque membre:
 *    - racines => depth=0
 *    - enfant => depth = max(depth(parents)) + 1
 * 3) Calculer la "largeur" nécessaire de chaque sous-arbre (mesure),
 *    pour réserver de l'espace horizontal sans chevauchement.
 * 4) Assigner des x (centres) en parcourant récursivement racines → unions → enfants.
 * 5) Convertir en LayoutNode[] pour membres et unions.
 *
 * Hypothèses/implicites (importantes):
 * - Le graphe doit être "quasi-arbre" orienté descendants (pas de cycles parentaux).
 * - Un membre a au plus une parentUnion (sinon depth ambigu).
 * - On ne gère pas de "fusion" de sous-arbres (un enfant apparaissant dans plusieurs unions).
 */
export function computeLayout(input: Input): LayoutNode[] {
  /** Index: member id -> Member */
  const memberMap = new Map(input.members.map((m) => [m.id, m]));
  /** Index: union id -> Union */
  const unionMap = new Map(input.unions.map((u) => [u.id, u]));

  /**
   * Index dérivé: partnerId -> [unionId...]
   * Sert à retrouver toutes les unions "enfants" d'un membre
   * (c.-à-d. les unions où il/elle est partenaire).
   */
  const unionsByPartner = new Map<string, string[]>();
  for (const u of input.unions) {
    for (const p of u.partners) {
      const arr = unionsByPartner.get(p) ?? [];
      arr.push(u.id);
      unionsByPartner.set(p, arr);
    }
  }

  /**
   * depth(mid) = génération du membre:
   * - 0 si pas de parentUnion (racine)
   * - sinon max(depth(partners de l'union parentale)) + 1
   */
  const depth = new Map<string, number>();

  /**
   * Calcule depth(mid) avec mémoïsation.
   *
   * Cas fallback "dégradés":
   * - membre introuvable => depth 0
   * - pas de parentUnion => depth 0
   * - union parentale introuvable => depth 0
   *
   * ⚠️ Si le graphe contient un cycle (ex: A est ancêtre de A),
   * cette fonction pourrait boucler (ici pas de détection de cycle).
   */
  function computeDepth(mid: string): number {
    if (depth.has(mid)) return depth.get(mid)!;

    const m = memberMap.get(mid);
    if (!m) {
      depth.set(mid, 0);
      return 0;
    }

    if (!m.parentUnion) {
      depth.set(mid, 0);
      return 0;
    }

    const pu = unionMap.get(m.parentUnion);
    if (!pu) {
      depth.set(mid, 0);
      return 0;
    }

    // Profondeur d’un enfant = 1 + max(profondeur des partenaires parents)
    const parentDepths = pu.partners.map((pid) => computeDepth(pid));
    const d = Math.max(...parentDepths) + 1;

    depth.set(mid, d);
    return d;
  }

  /** On force le calcul pour tous les membres */
  for (const m of input.members) computeDepth(m.id);

  /** Profondeur max (pas utilisée ensuite: vestige / debug potentiel) */
  const maxDepth = Math.max(0, ...[...depth.values()]);

  /**
   * Pour chaque membre, liste de ses unions "descendantes" (où il est partenaire).
   * On utilise unionsByPartner reconstruit depuis unions[].partners.
   */
  const memberChildrenUnions = new Map<string, string[]>();
  for (const m of input.members) {
    memberChildrenUnions.set(m.id, unionsByPartner.get(m.id) ?? []);
  }

  /**
   * xPosMember : memberId -> x center
   * xPosUnion  : unionId  -> x center
   */
  const xPosMember = new Map<string, number>();
  const xPosUnion = new Map<string, number>();

  /**
   * MESURE (largeur) d'un sous-arbre union:
   * - Si pas d'enfants: largeur min UNION_W
   * - Sinon: somme des largeurs des sous-arbres enfants + gaps
   * - Toujours au moins UNION_W
   *
   * But: réserver assez d'espace horizontal pour ne pas chevaucher.
   */
  function measureUnion(u: Union): number {
    if (u.children.length === 0) return UNION_W;

    let sum = 0;
    for (const cid of u.children) sum += measureMember(cid);

    // gap entre enfants
    sum += H_GAP * Math.max(0, u.children.length - 1);

    return Math.max(UNION_W, sum);
  }

  /**
   * MESURE (largeur) d'un sous-arbre membre:
   * - Si pas d'unions descendantes: largeur min MEMBER_W
   * - Sinon: somme des largeurs des unions descendantes + gaps
   * - Toujours au moins MEMBER_W
   *
   * Note: un membre peut avoir plusieurs unions => layout "en éventail" horizontal.
   */
  function measureMember(mid: string): number {
    const unions = memberChildrenUnions.get(mid) ?? [];
    if (unions.length === 0) return MEMBER_W;

    let sum = 0;
    for (const uid of unions) sum += measureUnion(unionMap.get(uid)!);

    // gap entre unions
    sum += H_GAP * Math.max(0, unions.length - 1);

    return Math.max(MEMBER_W, sum);
  }

  /**
   * Map "measured" calculée mais jamais réutilisée ensuite:
   * - utile pour debug/optim (éviter de recalculer), mais ici non exploitée.
   * (Le code rappelle measureMember/Union plusieurs fois => coût potentiellement élevé.)
   */
  const measured = new Map<string, number>();
  for (const m of input.members) measured.set(m.id, measureMember(m.id));

  /**
   * Groupement des membres par profondeur.
   * (Ici aussi: construit et trié, mais pas utilisé ensuite.)
   * Ça ressemble à une fonctionnalité "layout par niveaux" abandonnée.
   */
  const membersByDepth = new Map<number, string[]>();
  for (const [id, d] of depth.entries()) {
    const arr = membersByDepth.get(d) ?? [];
    arr.push(id);
    membersByDepth.set(d, arr);
  }
  for (const d of membersByDepth.keys()) {
    membersByDepth.get(d)!.sort((a, b) => a.localeCompare(b));
  }

  /**
   * ASSIGNATION des positions X (récursive).
   *
   * On donne à mid un intervalle horizontal [left, left+width],
   * puis:
   * - on place le membre au centre
   * - on place ses unions en sous-intervalles, de gauche à droite
   * - pour chaque union, on place ses enfants sous les unions
   *
   * Résultat:
   * - Tous les nœuds ont un x (centre).
   * - La structure est "compacte" sans chevauchement si le graphe est un arbre.
   *
   * ⚠️ Le membre peut être re-assigné si appelé plusieurs fois via plusieurs chemins.
   * Ici on suppose un arbre (chaque enfant est atteint par un seul chemin).
   */
  function assignMember(mid: string, left: number) {
    const width = measureMember(mid);
    const center = left + width / 2;
    xPosMember.set(mid, center);

    const unions = memberChildrenUnions.get(mid) ?? [];
    if (unions.length === 0) return;

    let cursor = left;
    for (const uid of unions) {
      const u = unionMap.get(uid)!;
      const uw = measureUnion(u);

      // Centre de l'union dans son sous-intervalle
      const uCenter = cursor + uw / 2;
      xPosUnion.set(uid, uCenter);

      // Placer les enfants sous cette union
      if (u.children.length > 0) {
        let childCursor = cursor;
        for (const cid of u.children) {
          const cw = measureMember(cid);
          assignMember(cid, childCursor);
          childCursor += cw + H_GAP;
        }
      }

      // Avancer au prochain bloc union
      cursor += uw + H_GAP;
    }
  }

  /**
   * Détection des racines:
   * membres sans parentUnion => génération 0.
   * On les trie par id pour un ordre déterministe.
   */
  const roots = input.members
      .filter((m) => !m.parentUnion)
      .map((m) => m.id)
      .sort((a, b) => a.localeCompare(b));

  /**
   * Placement des racines les unes à la suite, avec un gap plus large (H_GAP*2).
   * Chaque racine déclenche l'assignation récursive de son sous-arbre.
   */
  let rootCursor = 0;
  for (const r of roots) {
    const rw = measureMember(r);
    assignMember(r, rootCursor);
    rootCursor += rw + H_GAP * 2;
  }

  /**
   * Construction de la sortie.
   * - Pour les membres: y = depth * LEVEL_Y
   * - Pour les unions: y = max(depth(partners)) * LEVEL_Y + UNION_Y_OFFSET
   */
  const out: LayoutNode[] = [];

  // Nœuds membres
  for (const [mid, x] of xPosMember.entries()) {
    const d = depth.get(mid) ?? 0;
    out.push({
      id: mid,
      type: "MEMBER",
      x,
      y: d * LEVEL_Y,
    });
  }

  // Nœuds unions
  for (const [uid, x] of xPosUnion.entries()) {
    const u = unionMap.get(uid);
    if (!u) continue;

    // L'union est placée au niveau le plus bas de ses partenaires (souvent identique),
    // puis décalée vers le bas pour être entre parents et enfants.
    const partnerDepths = u.partners.map((p) => depth.get(p) ?? 0);
    const d = Math.max(...partnerDepths);

    out.push({
      id: uid,
      type: "UNION",
      x,
      y: d * LEVEL_Y + UNION_Y_OFFSET,
    });
  }

  return out;
}