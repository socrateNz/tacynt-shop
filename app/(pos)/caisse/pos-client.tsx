"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/money";
import { hasCapability, type Role } from "@/lib/permissions";
import {
  countPendingSales,
  getCatalog,
  getSyncMeta,
  setSyncMeta,
  type CatalogProduct,
} from "@/lib/pos/db";
import {
  createLocalSale,
  flushQueue,
  loadCatalogFromServer,
  openCashSession,
  startSyncLoop,
} from "@/lib/pos/sync-engine";

import { PrintableTicket, type TicketData } from "./printable-ticket";

type CartLine = {
  variantId: string;
  designation: string;
  prixUnitaire: number;
  quantite: number;
  remise: number;
};

type HeldTicket = { id: string; label: string; lines: CartLine[] };

type PaymentMode = "ESPECES" | "MOBILE_MONEY" | "CARTE" | "VIREMENT" | "ARDOISE" | "BON_ACHAT";
type PaymentDraft = { mode: PaymentMode; montant: string };

const PAYMENT_MODES: { value: PaymentMode; label: string }[] = [
  { value: "ESPECES", label: "Espèces" },
  { value: "MOBILE_MONEY", label: "Mobile Money" },
  { value: "CARTE", label: "Carte" },
  { value: "VIREMENT", label: "Virement" },
  { value: "ARDOISE", label: "Ardoise" },
  { value: "BON_ACHAT", label: "Bon d'achat" },
];

export function PosClient({
  registerId,
  registerCode,
  registerNom,
  organizationNom,
  devise,
  role,
  discountCeiling,
}: {
  registerId: string;
  registerCode: string;
  registerNom: string;
  organizationNom: string;
  devise: string;
  role: Role;
  discountCeiling: number;
}) {
  const unlimitedDiscount = hasCapability(role, "pos:discount:unlimited");

  const [ready, setReady] = useState(false);
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [fondInitialInput, setFondInitialInput] = useState("0");

  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [heldTickets, setHeldTickets] = useState<HeldTicket[]>([]);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [payments, setPayments] = useState<PaymentDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastTicket, setLastTicket] = useState<TicketData | null>(null);

  const [pendingCount, setPendingCount] = useState(0);

  const [closeOpen, setCloseOpen] = useState(false);
  const [compteFinalInput, setCompteFinalInput] = useState("0");
  const [closeSummary, setCloseSummary] = useState<{
    especesTheoriques: number;
    ecart: number;
  } | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const cartRef = useRef(cart);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    let ignore = false;

    (async () => {
      if (typeof navigator !== "undefined" && navigator.onLine) {
        try {
          await loadCatalogFromServer();
        } catch {
          // Hors ligne / erreur réseau : on retombe sur le cache local.
        }
      }
      const [c, meta, pending] = await Promise.all([
        getCatalog(),
        getSyncMeta(),
        countPendingSales(),
      ]);
      if (ignore) return;
      setCatalog(c);
      setSessionId(meta.sessionId);
      setPendingCount(pending);
      setReady(true);
    })();

    const stopLoop = startSyncLoop(15000);
    const refreshPending = setInterval(() => {
      void countPendingSales().then((n) => {
        if (!ignore) setPendingCount(n);
      });
    }, 4000);

    return () => {
      ignore = true;
      stopLoop();
      clearInterval(refreshPending);
    };
  }, []);

  const filteredCatalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return catalog
      .filter(
        (p) =>
          p.designation.toLowerCase().includes(q) ||
          p.reference.toLowerCase().includes(q) ||
          p.codeBarres === query.trim(),
      )
      .slice(0, 8);
  }, [catalog, query]);

  function addToCart(product: CatalogProduct) {
    setCart((prev) => {
      const existing = prev.find((l) => l.variantId === product.variantId);
      if (existing) {
        return prev.map((l) =>
          l.variantId === product.variantId ? { ...l, quantite: l.quantite + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          variantId: product.variantId,
          designation: product.designation,
          prixUnitaire: product.prixVente,
          quantite: 1,
          remise: 0,
        },
      ];
    });
    setQuery("");
    searchRef.current?.focus();
  }

  function handleSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const exact = catalog.find((p) => p.codeBarres && p.codeBarres === query.trim());
    const candidate = exact ?? (filteredCatalog.length === 1 ? filteredCatalog[0] : null);
    if (candidate) addToCart(candidate);
  }

  function updateQuantity(variantId: string, quantite: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.variantId === variantId ? { ...l, quantite: Math.max(0, quantite) } : l))
        .filter((l) => l.quantite > 0),
    );
  }

  function updateRemise(variantId: string, remise: number) {
    const amount = Math.max(0, Number.isFinite(remise) ? remise : 0);
    if (!unlimitedDiscount && amount > discountCeiling) {
      setError(`Remise plafonnée à ${formatMoney(discountCeiling, devise)} pour votre rôle.`);
      return;
    }
    setError(null);
    setCart((prev) => prev.map((l) => (l.variantId === variantId ? { ...l, remise: amount } : l)));
  }

  function removeLastLine() {
    setCart((prev) => prev.slice(0, -1));
  }

  function holdCart() {
    if (cartRef.current.length === 0) return;
    setHeldTickets((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: new Date().toLocaleTimeString("fr-FR"), lines: cartRef.current },
    ]);
    setCart([]);
  }

  function resumeHeld(id: string) {
    const held = heldTickets.find((h) => h.id === id);
    if (!held) return;
    setCart(held.lines);
    setHeldTickets((prev) => prev.filter((h) => h.id !== id));
  }

  const cartTotal = useMemo(
    () => cart.reduce((sum, l) => sum + l.prixUnitaire * l.quantite - l.remise, 0),
    [cart],
  );

  function openCheckout() {
    if (cartRef.current.length === 0) return;
    setPayments([{ mode: "ESPECES", montant: cartTotal.toFixed(2) }]);
    setError(null);
    setCheckoutOpen(true);
  }

  const paymentsTotal = payments.reduce((sum, p) => sum + (Number(p.montant) || 0), 0);

  async function confirmCheckout() {
    if (Math.abs(paymentsTotal - cartTotal) > 0.01) {
      setError("Le total des paiements doit correspondre au total du ticket.");
      return;
    }

    const lines = cart.map((l) => ({
      variantId: l.variantId,
      quantite: l.quantite,
      prixUnitaire: l.prixUnitaire,
      remise: l.remise,
    }));
    const paymentLines = payments.map((p) => ({ mode: p.mode, montant: Number(p.montant) || 0 }));

    const sale = await createLocalSale({ lines, payments: paymentLines });

    setLastTicket({
      numero: sale.numero,
      createdAt: sale.clientCreatedAt,
      organizationNom,
      lines: cart.map((l) => ({
        designation: l.designation,
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        remise: l.remise,
      })),
      payments: paymentLines,
      totalTtc: cartTotal,
      devise,
    });

    setCart([]);
    setCheckoutOpen(false);
    setPendingCount(await countPendingSales());
  }

  async function handleOpenSession() {
    const fondInitial = Number(fondInitialInput) || 0;
    const id = await openCashSession(registerId, registerCode, fondInitial);
    setSessionId(id);
  }

  async function handleSyncNow() {
    const summary = await flushQueue();
    if (summary) setPendingCount(await countPendingSales());
    if (summary === null) {
      setError("Synchronisation impossible (hors ligne ou déjà en cours).");
    } else if (summary.errors > 0) {
      setError("Certaines ventes n'ont pas pu être synchronisées, réessayez.");
    } else {
      setError(null);
    }
  }

  function openCloseDialog() {
    if (pendingCount > 0) {
      setError("Synchronisez les ventes en attente avant de fermer la caisse.");
      return;
    }
    setCloseSummary(null);
    setCloseOpen(true);
  }

  async function handleCloseSession() {
    if (!sessionId) return;
    const compteFinal = Number(compteFinalInput) || 0;
    const res = await fetch(`/api/pos/sessions/${sessionId}/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compteFinal }),
    });
    if (!res.ok) {
      setError("Impossible de fermer la caisse (vérifiez la connexion).");
      return;
    }
    const data = (await res.json()) as { especesTheoriques: number; ecart: number };
    setCloseSummary(data);
    await setSyncMeta({ sessionId: null });
    setSessionId(null);
  }

  // Raccourcis clavier complets (section 5.3) : F1 recherche, F2 remise,
  // F3 client, F4 mise en attente, F9 encaisser, Échap annuler ligne.
  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "F1") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "F2") {
        e.preventDefault();
        const last = cartRef.current.at(-1);
        if (last) document.getElementById(`remise-${last.variantId}`)?.focus();
      } else if (e.key === "F3") {
        e.preventDefault();
        setError("Clients disponibles à partir de la Phase 2.");
      } else if (e.key === "F4") {
        e.preventDefault();
        holdCart();
      } else if (e.key === "F9") {
        e.preventDefault();
        openCheckout();
      } else if (e.key === "Escape" && !checkoutOpen && !closeOpen) {
        e.preventDefault();
        removeLastLine();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // openCheckout/holdCart/removeLastLine intentionally omitted : elles ne
    // sont pas mémoïsées, les inclure re-créerait ce listener à chaque
    // rendu. cartRef garde toujours la dernière valeur du panier pour elles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutOpen, closeOpen, cartTotal]);

  if (!ready) {
    return <div className="flex flex-1 items-center justify-center text-muted-foreground">Chargement…</div>;
  }

  if (!sessionId) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8">
          <h1 className="text-lg font-semibold text-foreground">
            Ouvrir la caisse — {registerNom}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Déclarez le fond de caisse pour commencer à encaisser.
          </p>
          <div className="mt-6 flex flex-col gap-1.5">
            <Label htmlFor="fond">Fond initial</Label>
            <Input
              id="fond"
              type="number"
              step="0.01"
              value={fondInitialInput}
              onChange={(e) => setFondInitialInput(e.target.value)}
            />
          </div>
          <Button className="mt-6 w-full" onClick={handleOpenSession}>
            Ouvrir la caisse
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {organizationNom} — {registerNom}
          </p>
          <p className="text-xs text-muted-foreground">
            {pendingCount > 0 ? `${pendingCount} vente(s) en attente de synchro` : "À jour"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleSyncNow}>
              Synchroniser maintenant
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={openCloseDialog}>
            Fermer la caisse
          </Button>
        </div>
      </header>

      {error && (
        <p className="mx-6 mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid flex-1 grid-cols-1 gap-4 p-6 lg:grid-cols-3">
        <div className="flex flex-col gap-3 lg:col-span-2">
          <div className="relative">
            <Input
              ref={searchRef}
              autoFocus
              placeholder="Rechercher / scanner (F1)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            {filteredCatalog.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
                {filteredCatalog.map((p) => (
                  <button
                    key={p.variantId}
                    type="button"
                    onClick={() => addToCart(p)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span>{p.designation}</span>
                    <span className="num text-muted-foreground">
                      {formatMoney(p.prixVente, devise)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-1 flex-col rounded-xl border border-border bg-card">
            <div className="flex flex-col divide-y divide-border">
              {cart.map((l) => (
                <div key={l.variantId} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1">
                    <p className="text-sm text-foreground">{l.designation}</p>
                    <p className="num text-xs text-muted-foreground">
                      {formatMoney(l.prixUnitaire, devise)} l&apos;unité
                    </p>
                  </div>
                  <Input
                    type="number"
                    value={l.quantite}
                    onChange={(e) => updateQuantity(l.variantId, Number(e.target.value))}
                    className="w-16"
                  />
                  <Input
                    id={`remise-${l.variantId}`}
                    type="number"
                    value={l.remise}
                    onChange={(e) => updateRemise(l.variantId, Number(e.target.value))}
                    className="w-20"
                    title="Remise (F2)"
                  />
                  <p className="num w-24 text-right text-sm text-foreground">
                    {formatMoney(l.prixUnitaire * l.quantite - l.remise, devise)}
                  </p>
                </div>
              ))}
              {cart.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Panier vide — scannez ou recherchez un article.
                </p>
              )}
            </div>
          </div>

          {heldTickets.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">
                Tickets en attente
              </p>
              <div className="flex flex-wrap gap-2">
                {heldTickets.map((h) => (
                  <Button key={h.id} variant="outline" size="sm" onClick={() => resumeHeld(h.id)}>
                    {h.label} ({h.lines.length})
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase">Total</p>
            <p className="num text-3xl font-semibold text-foreground">
              {formatMoney(cartTotal, devise)}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={openCheckout} disabled={cart.length === 0}>
              Encaisser (F9)
            </Button>
            <Button variant="outline" onClick={holdCart} disabled={cart.length === 0}>
              Mettre en attente (F4)
            </Button>
            <Button variant="ghost" onClick={removeLastLine} disabled={cart.length === 0}>
              Annuler la ligne (Échap)
            </Button>
          </div>

          {lastTicket && (
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground">
                Vente enregistrée — {lastTicket.numero}
              </p>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                Imprimer le ticket
              </Button>
              <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                <PrintableTicket ticket={lastTicket} />
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Encaissement — {formatMoney(cartTotal, devise)}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {payments.map((p, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label>Mode</Label>
                  <select
                    value={p.mode}
                    onChange={(e) =>
                      setPayments((prev) =>
                        prev.map((pp, idx) =>
                          idx === i ? { ...pp, mode: e.target.value as PaymentMode } : pp,
                        ),
                      )
                    }
                    className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
                  >
                    {PAYMENT_MODES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex w-28 flex-col gap-1.5">
                  <Label>Montant</Label>
                  <Input
                    type="number"
                    value={p.montant}
                    onChange={(e) =>
                      setPayments((prev) =>
                        prev.map((pp, idx) => (idx === i ? { ...pp, montant: e.target.value } : pp)),
                      )
                    }
                  />
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() =>
                setPayments((prev) => [...prev, { mode: "ESPECES", montant: "0" }])
              }
            >
              + Paiement mixte
            </Button>
            <p className="text-sm text-muted-foreground">
              Réglé : {formatMoney(paymentsTotal, devise)} / {formatMoney(cartTotal, devise)}
            </p>
          </div>
          <DialogFooter>
            <Button onClick={confirmCheckout}>Valider l&apos;encaissement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fermeture de caisse</DialogTitle>
          </DialogHeader>
          {closeSummary ? (
            <div className="flex flex-col gap-2 text-sm">
              <p>Espèces théoriques : {formatMoney(closeSummary.especesTheoriques, devise)}</p>
              <p className={closeSummary.ecart !== 0 ? "text-destructive" : "text-success"}>
                Écart : {formatMoney(closeSummary.ecart, devise)}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="compteFinal">Comptage physique</Label>
              <Input
                id="compteFinal"
                type="number"
                step="0.01"
                value={compteFinalInput}
                onChange={(e) => setCompteFinalInput(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            {closeSummary ? (
              <Button onClick={() => setCloseOpen(false)}>Fermer</Button>
            ) : (
              <Button onClick={handleCloseSession}>Valider la fermeture</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
