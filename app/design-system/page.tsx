import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function CaCard() {
  return (
    <Card className="bg-background">
      <CardHeader>
        <CardTitle className="text-xs font-medium tracking-wide text-subtle-foreground uppercase">
          Chiffre d&apos;affaires
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <p className="font-mono text-3xl font-semibold tabular-nums">
          184 500 <span className="text-base font-normal text-subtle-foreground">FCFA</span>
        </p>
        <p className="text-sm font-mono text-success">+12,4 % vs mardi</p>
      </CardContent>
    </Card>
  );
}

const produits = [
  { nom: "Savon de Marseille 200 g", ref: "REF-00841", stock: "128", prix: "750", etat: "En stock" as const },
  { nom: "Huile de palme 1 L", ref: "REF-01207", stock: "6", prix: "1 800", etat: "Seuil atteint" as const },
  { nom: "Riz parfumé 5 kg", ref: "REF-00093", stock: "0", prix: "6 500", etat: "Rupture" as const },
  { nom: "Cahier 200 pages", ref: "REF-01844", stock: "340", prix: "500", etat: "Dormant" as const },
];

const badgeVariantByEtat = {
  "En stock": "success",
  "Seuil atteint": "warning",
  Rupture: "destructive",
  Dormant: "secondary",
} as const;

export default function DesignSystem() {
  return (
    <div className="flex flex-1 flex-col items-center bg-background px-6 py-16">
      <div className="flex w-full max-w-3xl flex-col gap-12">
        <header className="flex items-start justify-between gap-4 border-b border-border pb-6">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium tracking-widest text-subtle-foreground uppercase">
              Fondations design system
            </p>
            <h1 className="text-2xl font-semibold text-foreground">Tacynt Shop</h1>
            <p className="text-sm text-muted-foreground">
              Système d&apos;interface — thèmes clair et sombre, un seul accent.
            </p>
          </div>
          <ThemeToggle />
        </header>

        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium text-foreground">Parité des thèmes</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="light rounded-xl border border-border bg-background p-4">
              <p className="mb-3 text-xs font-medium tracking-widest text-subtle-foreground uppercase">
                Thème clair
              </p>
              <CaCard />
            </div>
            <div className="dark rounded-xl border border-border bg-background p-4">
              <p className="mb-3 text-xs font-medium tracking-widest text-subtle-foreground uppercase">
                Thème sombre
              </p>
              <CaCard />
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium text-foreground">Actions et saisie</h2>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-4">
            <Button>Encaisser</Button>
            <Button variant="outline">Mettre en attente</Button>
            <Button variant="ghost">Annuler la ligne</Button>
            <Button variant="destructive">Annuler le ticket</Button>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-medium text-foreground">Stock</h2>
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Prix</TableHead>
                  <TableHead>État</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {produits.map((p) => (
                  <TableRow key={p.ref}>
                    <TableCell className="text-foreground">{p.nom}</TableCell>
                    <TableCell className="num text-muted-foreground">{p.ref}</TableCell>
                    <TableCell className="num text-right">{p.stock}</TableCell>
                    <TableCell className="num text-right">{p.prix}</TableCell>
                    <TableCell>
                      <Badge variant={badgeVariantByEtat[p.etat]}>{p.etat}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </div>
  );
}
