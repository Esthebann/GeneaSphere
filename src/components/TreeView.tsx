"use client";

/**
 * =========================================================
 * TreeView (arbre généalogique en SVG) — commentaires "tout public"
 * =========================================================
 *
 * Objectif (en 1 phrase)
 * - Afficher un arbre (personnes + unions) avec des boîtes et des traits,
 *   en utilisant des positions (x,y) envoyées par le serveur.
 *
 * Glossaire (mots simples)
 * - MEMBER = une personne (boîte blanche)
 * - UNION  = un couple / une relation (boîte noire)
 * - NODE   = MEMBER ou UNION
 * - LAYOUT = la liste des positions (x,y) calculées côté serveur
 *
 * Point IMPORTANT (le piège n°1)
 * - Le serveur donne (x,y) comme le CENTRE de la boîte.
 * - SVG <rect> a besoin du COIN haut-gauche.
 *   → donc: coin = centre - (largeur/2, hauteur/2)
 *
 * Caméra (pan/zoom)
 * - On ne bouge jamais les boîtes.
 * - On bouge la "caméra" avec le viewBox de l’SVG.
 *   viewBox = "x y w h" (où on regarde + niveau de zoom)
 *
 * Où modifier le comportement (les “règles produit”)
 * - Unions visibles/cachées: visibleUnionIds (section 2)
 * - Focus (n’afficher que le voisinage): focusSet (section 4)
 * - Opacité hors focus: alphaNode / alphaEdge (section 9)
 * - Couleurs (parents/spouses/enfants): memberStroke/unionStroke/edgeStroke (section 10)
 */

import { useEffect, useMemo, useRef, useState } from "react";

/** Données Member reçues du backend */
type Member = {
  id: string;
  firstName: string;
  lastName: string;
  sex: "M" | "F" | "X";
  visibility: "PUBLIC" | "PRIVATE";
  unions: string[];          // ids des unions où ce membre est partenaire
  parentUnion: string | null;// id de l’union de ses parents (si connu)
  version: number;

  // champs optionnels
  photoUrl?: string | null;
  professions?: string[];
  addresses?: string[];
  phones?: string[];
  emails?: string[];
  notes?: string | null;
};

/** Données Union reçues du backend */
type Union = {
  id: string;
  partners: string[]; // ids des partenaires
  children: string[]; // ids des enfants
  status: string | null;
  startDate: string | null;
  endDate: string | null;
  version: number;
};

/**
 * LayoutNode = position pré-calculée côté serveur.
 * Convention ici:
 * - x,y = centre de la boîte (pas le coin haut-gauche)
 *
 * IMPORTANT:
 * - Quand on dessine <rect>, on doit convertir centre -> coin haut-gauche
 *   car SVG attend x,y = coin haut-gauche.
 */
type LayoutNode = {
  id: string;
  type: "MEMBER" | "UNION";
  x: number;
  y: number;
};

type LayoutResponse = {
  members: Member[];
  unions: Union[];
  layout: LayoutNode[];
};

/** Dimensions (en coordonnées SVG) des boîtes */
const MEMBER_W = 140;
const MEMBER_H = 60;
const UNION_W = 220;
const UNION_H = 34;

/** Borne un nombre entre [a,b] */
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/**
 * Formate un “nom court”:
 * - prénom => initiale + "."
 * - nom => complet
 * Exemple: "J. Dupont"
 */
function shortName(m: Member | undefined) {
  if (!m) return "Unknown";
  const fn = (m.firstName || "").trim();
  const ln = (m.lastName || "").trim();
  const f = fn ? fn[0].toUpperCase() + "." : "";
  const l = ln ? ln : "";
  const s = (f + (f && l ? " " : "") + l).trim();
  return s || "Unknown";
}

/**
 * TreeView:
 * - data = { members, unions, layout } (déjà positionné)
 * - sélection contrôlée par parent
 * - focusMode = ne garder visible que ce qui est "proche" de la sélection
 * - expandedUnionIds = unions “dépliées” (sinon cachées pour réduire l’encombrement visuel)
 * - visibleOnlyIds = filtre additionnel (ex: résultat de recherche/permissions)
 */
export function TreeView(props: {
  data: LayoutResponse;
  onSelect: (node: { id: string; type: "MEMBER" | "UNION" } | null) => void;
  selected: { id: string; type: "MEMBER" | "UNION" } | null;

  focusMode: boolean;
  focusHideOutside: boolean;
  focusRadius: number;

  expandedUnionIds: Set<string>;
  onToggleUnion: (unionId: string) => void;

  visibleOnlyIds?: Set<string> | null;
}) {
  const { data } = props;

  // =========================
  // 1) INDEXATIONS (Maps)
  // =========================
  // Objectif: accéder vite aux données par id (sans faire .find() partout).

  // memberMap: id -> Member (retrouver vite un membre)
  const memberMap = useMemo(() => new Map(data.members.map((m) => [m.id, m])), [data]);

  // unionMap: id -> Union (retrouver vite une union)
  const unionMap = useMemo(() => new Map(data.unions.map((u) => [u.id, u])), [data]);

  // pos: id -> LayoutNode (retrouver vite la position x,y d’un id)
  // Rappel: x,y = CENTRE de la boîte.
  const pos = useMemo(() => new Map(data.layout.map((n) => [n.id, n])), [data]);

  /**
   * Label affiché dans la boîte UNION.
   *
   * Important à savoir:
   * - suppose qu’il y a au moins 2 partners (partners[0], partners[1])
   * - sinon le label peut être "Unknown + Unknown"
   */
  function unionLabel(u: Union) {
    const p1 = shortName(memberMap.get(u.partners[0]));
    const p2 = shortName(memberMap.get(u.partners[1]));
    const st = (u.status ?? "UNION").trim();
    return `${p1} + ${p2} · ${st}`;
  }

  // =========================
  // 2) "COLLAPSE" DES UNIONS
  // =========================
  /**
   * Problème UX:
   * - si on affiche toutes les unions de tout le monde, l'écran devient illisible.
   *
   * Solution:
   * visibleUnionIds = set des unions qu’on va rendre.
   *
   * Règles (faciles à modifier):
   * 1) Pour chaque membre, on montre seulement son union “active”
   *    → ici: la DERNIÈRE union dans m.unions
   *    (donc l’ordre renvoyé par l’API est important)
   * 2) On ajoute les unions explicitement dépliées (expandedUnionIds)
   * 3) On ajoute l’union sélectionnée (si selected est une UNION)
   *
   * Si demain tu veux "tout afficher", c’est ici qu’il faut changer.
   */
  const visibleUnionIds = useMemo(() => {
    const s = new Set<string>();

    // union active = dernière union de la liste
    for (const m of data.members) {
      if (m.unions.length === 0) continue;
      const active = m.unions[m.unions.length - 1];
      s.add(active);
    }

    // unions dépliées
    for (const id of props.expandedUnionIds) s.add(id);

    // union sélectionnée
    if (props.selected?.type === "UNION") s.add(props.selected.id);

    return s;
  }, [data.members, props.expandedUnionIds, props.selected]);

  // filteredUnions = unions réellement utilisées pour edges + graphe
  // (autrement dit: on ignore les unions "cachées" pour ne pas dessiner leurs liens)
  const filteredUnions = useMemo(
      () => data.unions.filter((u) => visibleUnionIds.has(u.id)),
      [data.unions, visibleUnionIds]
  );

  // =========================
  // 3) GRAPHE D’ADJACENCE (pour focus)
  // =========================
  /**
   * Ici on prépare "qui est connecté à qui" sous forme de voisinage.
   *
   * adj: Map<nodeId, Set<neighborId>>
   *
   * On relie:
   * - partner <-> union
   * - union <-> child
   *
   * Remarque importante:
   * - On le construit à partir de filteredUnions (donc uniquement le sous-graphe visible),
   *   ce qui évite de "focuser" sur des choses qu'on a volontairement cachées.
   */
  const adj = useMemo(() => {
    const a = new Map<string, Set<string>>();

    function link(x: string, y: string) {
      if (!a.has(x)) a.set(x, new Set());
      if (!a.has(y)) a.set(y, new Set());
      a.get(x)!.add(y);
      a.get(y)!.add(x);
    }

    for (const u of filteredUnions) {
      for (const p of u.partners) link(p, u.id);
      for (const c of u.children) link(u.id, c);
    }
    return a;
  }, [filteredUnions]);

  // =========================
  // 4) FOCUS MODE (voisins proches)
  // =========================
  /**
   * focusSet = ensemble des nœuds "proches" de la sélection.
   *
   * Explication simple:
   * - radius = nombre de "liens" qu’on est prêt à parcourir.
   * - radius=1 => seulement les voisins directs
   * - radius=2 => voisins + voisins des voisins
   * etc.
   *
   * On limite radius entre 1 et 6 pour éviter de tout englober sur un grand arbre.
   *
   * seen     = tout ce qu’on garde (déjà visité / déjà inclus)
   * frontier = les nœuds qu’on explore à l’étape courante
   */
  const focusSet = useMemo(() => {
    if (!props.focusMode || !props.selected) return null;

    const start = props.selected.id;
    const radius = clamp(props.focusRadius, 1, 6);

    const seen = new Set<string>([start]);
    let frontier = new Set<string>([start]);

    // exploration par couches successives (radius itérations max)
    for (let i = 0; i < radius; i++) {
      const next = new Set<string>();

      for (const v of frontier) {
        const neigh = adj.get(v);
        if (!neigh) continue;

        for (const n of neigh) {
          if (!seen.has(n)) {
            seen.add(n);
            next.add(n);
          }
        }
      }

      frontier = next;
      if (frontier.size === 0) break; // plus rien à explorer
    }

    return seen;
  }, [props.focusMode, props.selected, props.focusRadius, adj]);

  // =========================
  // 5) EDGES (traits SVG)
  // =========================
  /**
   * edges = liste de segments à dessiner
   *
   * Important:
   * - Le serveur donne les positions des boîtes (centres).
   * - Ici on calcule seulement les TRAITS entre boîtes.
   * - On ne recalcule pas la position des boîtes.
   *
   * Pour que les traits tombent "sur les bords":
   * - partner -> union : on part du bas du MEMBER vers le haut de l’UNION
   * - union -> child   : on part du bas de l’UNION vers le haut du MEMBER enfant
   */
  const edges = useMemo(() => {
    const lines: {
      x1: number; y1: number; x2: number; y2: number;
      a: string; b: string;
      kind: "PARENT" | "CHILD" | "SPOUSE" | "NEUTRAL";
    }[] = [];

    for (const u of filteredUnions) {
      const uPos = pos.get(u.id);
      if (!uPos) continue;

      // partners -> union
      for (const p of u.partners) {
        const pPos = pos.get(p);
        if (!pPos) continue;

        lines.push({
          x1: pPos.x,
          y1: pPos.y + MEMBER_H / 2,  // bas du rectangle member (car pos = centre)
          x2: uPos.x,
          y2: uPos.y - UNION_H / 2,   // haut du rectangle union (car pos = centre)
          a: p,
          b: u.id,
          kind: "SPOUSE", // type "UI" du lien (couleur/lecture)
        });
      }

      // union -> children
      for (const c of u.children) {
        const cPos = pos.get(c);
        if (!cPos) continue;

        lines.push({
          x1: uPos.x,
          y1: uPos.y + UNION_H / 2,   // bas union
          x2: cPos.x,
          y2: cPos.y - MEMBER_H / 2,  // haut enfant
          a: u.id,
          b: c,
          kind: "CHILD",
        });
      }
    }

    return lines;
  }, [filteredUnions, pos]);

  // =========================
  // 6) FILTRAGE DES NŒUDS À AFFICHER
  // =========================
  /**
   * visibleNodeIds:
   * On décide ici quels nodes méritent d’être rendus, même avant le focus.
   *
   * Règles:
   * - ajoute les “racines isolées” (membre sans unions et sans parentUnion)
   *   (sinon elles risquent de ne jamais apparaître car aucun edge ne les “réveille”)
   * - ajoute tous les nœuds touchés par les unions visibles (filteredUnions)
   * - ajoute la sélection (toujours visible)
   */
  const visibleNodeIds = useMemo(() => {
    const s = new Set<string>();

    // racines isolées
    for (const m of data.members) {
      if (m.unions.length === 0 && !m.parentUnion) s.add(m.id);
    }

    // sous-graphe des unions visibles
    for (const u of filteredUnions) {
      s.add(u.id);
      for (const p of u.partners) s.add(p);
      for (const c of u.children) s.add(c);
    }

    // sélection forcée
    if (props.selected) s.add(props.selected.id);

    return s;
  }, [data.members, filteredUnions, props.selected]);

  /**
   * effectiveVisibleIds:
   * Filtre additionnel (visibleOnlyIds) si fourni.
   *
   * - si visibleOnlyIds existe => intersection
   * - sinon => visibleNodeIds
   * - sélection forcée (toujours incluse)
   *
   * Exemple d’usage:
   * - permissions: n’afficher que certains ids
   * - recherche: n’afficher qu’un sous-ensemble (et garder la sélection)
   */
  const effectiveVisibleIds = useMemo(() => {
    if (!props.visibleOnlyIds) return visibleNodeIds;

    const s = new Set<string>();
    for (const id of visibleNodeIds) if (props.visibleOnlyIds.has(id)) s.add(id);
    if (props.selected) s.add(props.selected.id);
    return s;
  }, [props.visibleOnlyIds, visibleNodeIds, props.selected]);

  // =========================
  // 7) BOUNDS => viewBox initial
  // =========================
  /**
   * bounds calcule le rectangle qui englobe les nodes visibles.
   * On s’en sert pour cadrer la caméra au départ.
   *
   * - minX/minY/maxX/maxY sont calculés sur les CENTRES des boîtes
   * - puis on ajoute du padding autour (marges)
   */
  const bounds = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const n of data.layout) {
      if (!effectiveVisibleIds.has(n.id)) continue; // ignore nodes cachés
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x);
      maxY = Math.max(maxY, n.y);
    }

    // aucun node visible => fallback
    if (!isFinite(minX)) return { minX: 0, minY: 0, w: 1200, h: 800 };

    // padding autour
    return {
      minX: minX - 320,
      minY: minY - 220,
      w: (maxX - minX) + 700,
      h: (maxY - minY) + 520,
    };
  }, [data.layout, effectiveVisibleIds]);

  // =========================
  // 8) PAN / ZOOM via viewBox
  // =========================
  /**
   * viewBox = "caméra" de l’SVG.
   * view = { x, y, w, h }
   * - x,y = où on regarde (déplacement = pan)
   * - w,h = niveau de zoom (plus c’est petit => plus ça zoome)
   *
   * Important:
   * - on ne change jamais les positions des nodes
   * - on ne fait que bouger la caméra (viewBox)
   */
  const svgRef = useRef<SVGSVGElement | null>(null);

  // view = le viewBox courant (caméra)
  const [view, setView] = useState({ x: bounds.minX, y: bounds.minY, w: bounds.w, h: bounds.h });

  // drag = état temporaire pour le pan
  // startX/startY = position souris au début (en pixels écran)
  // baseX/baseY   = position caméra au début (en coordonnées monde)
  const [drag, setDrag] = useState<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);

  // quand bounds changent => recadrage automatique
  useEffect(() => {
    setView({ x: bounds.minX, y: bounds.minY, w: bounds.w, h: bounds.h });
  }, [bounds.minX, bounds.minY, bounds.w, bounds.h]);

  function resetView() {
    setView({ x: bounds.minX, y: bounds.minY, w: bounds.w, h: bounds.h });
  }

  /**
   * Centre la caméra sur un node id.
   * - on prend sa position (centre) dans pos
   * - on met le centre du viewBox sur ce point
   *
   * NOTE: on clamp le zoom (w/h) pour éviter un zoom trop extrême.
   */
  function centerOn(id: string) {
    const n = pos.get(id);
    if (!n) return;
    const w = clamp(view.w, 800, 2800);
    const h = clamp(view.h, 600, 1900);
    setView({ x: n.x - w / 2, y: n.y - h / 2, w, h });
  }

  // auto-center quand la sélection change
  useEffect(() => {
    if (props.selected) centerOn(props.selected.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.selected?.id]);

  /**
   * Zoom molette (comme une carte type Google Maps)
   *
   * Objectif:
   * - zoomer "vers la souris" (le point sous la souris reste sous la souris)
   *
   * Étapes:
   * 1) Convertir la position souris (pixels) en coordonnées du dessin (monde) => mx,my
   * 2) Changer la taille du viewBox (w/h) => zoom
   * 3) Ajuster x/y pour garder mx,my au même endroit sous le curseur
   */
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * view.w + view.x;
    const my = ((e.clientY - rect.top) / rect.height) * view.h + view.y;

    const zoom = e.deltaY < 0 ? 0.9 : 1.1;
    const newW = clamp(view.w * zoom, 500, 12000);
    const newH = clamp(view.h * zoom, 400, 9000);

    const nx = mx - ((mx - view.x) / view.w) * newW;
    const ny = my - ((my - view.y) / view.h) * newH;

    setView({ x: nx, y: ny, w: newW, h: newH });
  }

  // démarrage pan (on enregistre d'où on part)
  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return; // seulement clic gauche
    setDrag({ startX: e.clientX, startY: e.clientY, baseX: view.x, baseY: view.y });
  }

  // pan (déplacement caméra)
  function onMouseMove(e: React.MouseEvent) {
    if (!drag) return;
    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const dxPx = e.clientX - drag.startX;
    const dyPx = e.clientY - drag.startY;

    // conversion px -> coordonnées du dessin (monde)
    const dx = (dxPx / rect.width) * view.w;
    const dy = (dyPx / rect.height) * view.h;

    // on déplace la caméra en sens inverse du mouvement de la souris
    setView({ ...view, x: drag.baseX - dx, y: drag.baseY - dy });
  }

  // fin pan
  function onMouseUp() {
    setDrag(null);
  }

  // =========================
  // 9) VISIBILITÉ / OPACITÉ (focus)
  // =========================
  /**
   * Il y a 2 niveaux:
   * 1) effectiveVisibleIds = "filtrage dur" (si absent => pas rendu du tout)
   * 2) focusSet = "filtrage soft" (opacité faible) ou "hard" (caché), selon focusHideOutside
   */
  function isVisibleNode(id: string) {
    if (!effectiveVisibleIds.has(id)) return false; // filtrage dur
    if (!focusSet) return true;                     // pas de focus => visible
    if (focusSet.has(id)) return true;              // dans focus => visible
    return !props.focusHideOutside;                 // sinon visible seulement si on ne cache pas
  }

  // opacité des nodes hors focus
  function alphaNode(id: string) {
    if (!focusSet) return 1;
    return focusSet.has(id) ? 1 : 0.10;
  }

  // opacité des edges hors focus
  function alphaEdge(a: string, b: string) {
    if (!focusSet) return 1;
    const inA = focusSet.has(a);
    const inB = focusSet.has(b);
    if (inA && inB) return 1;
    return 0.06;
  }

  // =========================
  // 10) RELATIONS (parents / spouses / children) pour surligner
  // =========================
  /**
   * Quand on sélectionne un MEMBER, on veut surligner:
   * - ses parents (bleu)
   * - ses partenaires (violet)
   * - ses enfants (vert)
   * et aussi les unions associées.
   *
   * On prépare des "ensembles d'ids" (Sets) pour répondre vite:
   * - est-ce que ce member est un parent/spouse/enfant ?
   * - est-ce que cette union est l’union des parents / une union avec enfants ?
   */
  const relationSets = useMemo(() => {
    const parents = new Set<string>();
    const spouses = new Set<string>();
    const children = new Set<string>();
    const parentUnion = new Set<string>();
    const childUnions = new Set<string>();

    // on ne calcule ces sets que si un MEMBER est sélectionné
    if (!props.selected || props.selected.type !== "MEMBER") {
      return { parents, spouses, children, parentUnion, childUnions };
    }

    const m = memberMap.get(props.selected.id);
    if (!m) return { parents, spouses, children, parentUnion, childUnions };

    // parents via parentUnion
    // parentUnion -> Union.partners => ids des parents
    if (m.parentUnion) {
      const u = unionMap.get(m.parentUnion);
      if (u) {
        parentUnion.add(u.id);
        for (const p of u.partners) parents.add(p);
      }
    }

    // spouses + children via les unions où m est partenaire
    for (const uid of m.unions) {
      const u = unionMap.get(uid);
      if (!u) continue;
      childUnions.add(u.id);
      for (const p of u.partners) if (p !== m.id) spouses.add(p);
      for (const c of u.children) children.add(c);
    }

    return { parents, spouses, children, parentUnion, childUnions };
  }, [props.selected, memberMap, unionMap]);

  // couleur du contour MEMBER selon relation
  function memberStroke(id: string) {
    if (!props.selected || props.selected.type !== "MEMBER") return "#111";
    if (props.selected.id === id) return "#ffcc00";
    if (relationSets.parents.has(id)) return "#2f81f7";
    if (relationSets.spouses.has(id)) return "#a371f7";
    if (relationSets.children.has(id)) return "#3fb950";
    return "#111";
  }

  // couleur du contour UNION selon relation
  function unionStroke(id: string) {
    if (!props.selected || props.selected.type !== "MEMBER") return "#333";
    if (relationSets.parentUnion.has(id)) return "#2f81f7";
    if (relationSets.childUnions.has(id)) return "#3fb950";
    return "#333";
  }

  // couleur des edges selon kind
  function edgeStroke(kind: "PARENT" | "CHILD" | "SPOUSE" | "NEUTRAL") {
    if (kind === "CHILD") return "#3fb950";
    if (kind === "SPOUSE") return "#a371f7";
    if (kind === "PARENT") return "#2f81f7";
    return "#777";
  }

  /**
   * Déduit le kind d’un edge selon la sélection courante.
   *
   * Lecture "humaine":
   * - si le trait touche l’union des parents => on le colore "parents"
   * - si le trait touche une union où selected est partenaire => on le colore "enfants"
   * - sinon => "partenaires"
   */
  function edgeKind(a: string, b: string): "PARENT" | "CHILD" | "SPOUSE" | "NEUTRAL" {
    if (!props.selected || props.selected.type !== "MEMBER") return "NEUTRAL";
    if (relationSets.parentUnion.has(a) || relationSets.parentUnion.has(b)) return "PARENT";
    if (relationSets.childUnions.has(a) || relationSets.childUnions.has(b)) return "CHILD";
    return "SPOUSE";
  }

  // texte des chips d’union (tronqué)
  function chipText(u: Union) {
    const st = (u.status ?? "UNION").trim();
    return st.length > 10 ? st.slice(0, 10) + "…" : st;
  }

  // =========================
  // 11) RENDER SVG
  // =========================
  return (
      <div style={{ height: "86vh", display: "grid", gridTemplateRows: "auto 1fr" }}>
        {/* Toolbar */}
        <div style={{ display: "flex", gap: 8, padding: 10, borderBottom: "1px solid #222", color: "#ddd", background: "#0b0b0b" }}>
          <button onClick={resetView} style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #333", background: "#111", color: "#fff", cursor: "pointer" }}>
            Reset view
          </button>
          <button
              onClick={() => { if (props.selected) centerOn(props.selected.id); }}
              style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #333", background: "#111", color: "#fff", cursor: "pointer" }}
              disabled={!props.selected}
          >
            Center on selection
          </button>
          <div style={{ fontSize: 12, opacity: 0.85, alignSelf: "center" }}>
            Radius = graph distance (edges) around selection
          </div>
        </div>

        {/* Canvas SVG */}
        <svg
            ref={svgRef}
            viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} // <-- LA “CAMÉRA”: pan/zoom modifie ça
            onWheel={onWheel}                                   // <-- zoom molette
            onMouseDown={onMouseDown}                           // <-- début pan (clic + drag)
            onMouseMove={onMouseMove}                           // <-- pan en cours
            onMouseUp={onMouseUp}                               // <-- fin pan
            onMouseLeave={onMouseUp}                            // <-- fin pan si on sort du canvas
            style={{ background: "#0b0b0b", width: "100%", height: "100%", cursor: drag ? "grabbing" : "grab" }}
        >
          {/* rectangle de fond cliquable => désélection
              (transparent mais capte les clics) */}
          <rect x={view.x} y={view.y} width={view.w} height={view.h} fill="transparent" onClick={() => props.onSelect(null)} />

          {/* 11.1) EDGES (traits) */}
          {edges.map((l, i) => {
            const a = alphaEdge(l.a, l.b); // opacité selon focus
            if (focusSet && props.focusHideOutside && a < 0.5) return null; // cacher hors focus
            const k = edgeKind(l.a, l.b); // type logique (parents/enfants/partenaires) selon sélection
            return (
                <line
                    key={i}
                    x1={l.x1} y1={l.y1}
                    x2={l.x2} y2={l.y2}
                    stroke={edgeStroke(k)}      // couleur
                    strokeWidth="2.2"
                    opacity={a}
                />
            );
          })}

          {/* 11.2) NODES (boîtes) */}
          {data.layout.map((n) => {
            if (!isVisibleNode(n.id)) return null; // filtrage + focus

            const op = alphaNode(n.id);            // opacité selon focus

            // ------ MEMBER (personne) ------
            if (n.type === "MEMBER") {
              const m = memberMap.get(n.id)!;

              // IMPORTANT (piège n°1):
              // data.layout donne le CENTRE (n.x, n.y)
              // mais <rect> a besoin du coin haut-gauche:
              const x = n.x - MEMBER_W / 2;
              const y = n.y - MEMBER_H / 2;

              const stroke = memberStroke(n.id); // couleur selon relation (parents/spouse/enfant/selected)
              const strokeW = (props.selected?.type === "MEMBER" && props.selected.id === n.id) ? 3 : 2;

              // chips uniquement si:
              // - ce membre est sélectionné
              // - il a >1 union
              // But: permettre de déplier/replier les unions de ce membre
              const showChips =
                  props.selected?.type === "MEMBER" &&
                  props.selected.id === n.id &&
                  m.unions.length > 1;

              return (
                  <g
                      key={n.id}
                      onClick={(e) => { e.stopPropagation(); props.onSelect({ id: n.id, type: "MEMBER" }); }}
                      style={{ cursor: "pointer" }}
                      opacity={op}
                  >
                    <rect x={x} y={y} width={MEMBER_W} height={MEMBER_H} rx="12" ry="12" fill="#fff" stroke={stroke} strokeWidth={strokeW} />

                    {/* texte centré */}
                    <text x={n.x} y={n.y - 4} textAnchor="middle" fontSize="14">
                      {m.firstName} {m.lastName}
                    </text>
                    <text x={n.x} y={n.y + 14} textAnchor="middle" fontSize="12" fill="#666">
                      {m.sex} · {m.visibility}
                    </text>

                    {/* chips sous la box (toggle unions)
                        Chaque chip = une union du membre
                        Cliquer dessus => onToggleUnion(uid) => union affichée/cachée */}
                    {showChips ? (
                        <g>
                          {m.unions.map((uid, idx) => {
                            const u = unionMap.get(uid);
                            if (!u) return null;

                            const shown = visibleUnionIds.has(uid); // union visible ou non

                            // placement chips en grille 3 colonnes
                            const cols = 3;
                            const row = Math.floor(idx / cols);
                            const col = idx % cols;

                            const cx = x + col * 74;
                            const cy = y + MEMBER_H + 10 + row * 22;

                            const fill = shown ? "#1f6feb" : "#111";
                            const stroke2 = shown ? "#1f6feb" : "#333";
                            const txt = shown ? "#fff" : "#ddd";

                            return (
                                <g
                                    key={uid}
                                    onClick={(e) => { e.stopPropagation(); props.onToggleUnion(uid); }}
                                    style={{ cursor: "pointer" }}
                                >
                                  <rect x={cx} y={cy} width={70} height={18} rx={9} fill={fill} stroke={stroke2} />
                                  <text x={cx + 35} y={cy + 13} textAnchor="middle" fontSize="10" fill={txt}>
                                    {chipText(u)}
                                  </text>
                                </g>
                            );
                          })}
                        </g>
                    ) : null}
                  </g>
              );
            }

            // ------ UNION (couple/relation) ------
            const u = unionMap.get(n.id)!;

            // centre -> coin haut-gauche (même principe que MEMBER)
            const x = n.x - UNION_W / 2;
            const y = n.y - UNION_H / 2;

            const label = unionLabel(u);
            const stroke = unionStroke(n.id);

            return (
                <g
                    key={n.id}
                    onClick={(e) => { e.stopPropagation(); props.onSelect({ id: n.id, type: "UNION" }); }}
                    style={{ cursor: "pointer" }}
                    opacity={op}
                >
                  <rect x={x} y={y} width={UNION_W} height={UNION_H} rx="12" ry="12" fill="#111" stroke={stroke} strokeWidth={2.2} />
                  <text x={n.x} y={n.y + 5} textAnchor="middle" fontSize="12" fill="#fff">
                    {label.length > 34 ? label.slice(0, 33) + "…" : label}
                  </text>
                </g>
            );
          })}

          {/* Légende (pointerEvents none => ne bloque pas les clics) */}
          <g pointerEvents="none">
            <rect x={view.x + 20} y={view.y + 20} width={520} height={92} rx={12} fill="#111" stroke="#333" />
            <text x={view.x + 35} y={view.y + 45} fill="#ddd" fontSize="12">Legend</text>
            <text x={view.x + 35} y={view.y + 65} fill="#2f81f7" fontSize="12">Blue: Parents</text>
            <text x={view.x + 165} y={view.y + 65} fill="#a371f7" fontSize="12">Purple: Spouses</text>
            <text x={view.x + 315} y={view.y + 65} fill="#3fb950" fontSize="12">Green: Children</text>
            <text x={view.x + 35} y={view.y + 85} fill="#bbb" fontSize="12">Radius = number of edges around selected node</text>
            <text x={view.x + 35} y={view.y + 103} fill="#bbb" fontSize="12">Collapsed unions reduce clutter (expand via chips)</text>
          </g>
        </svg>
      </div>
  );
}