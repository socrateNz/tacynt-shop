"use client";

import { Users } from "lucide-react";

import { TablePanel } from "@/components/admin/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { assignUserToShop, unassignUserFromShop } from "./shop-users-actions";

export type ShopUserRow = {
  id: string;
  nom: string;
  email: string;
  role: string;
  assigned: boolean;
};

export function ShopUsersDialog({
  shopId,
  shopNom,
  users,
}: {
  shopId: string;
  shopNom: string;
  users: ShopUserRow[];
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Users className="size-3.5" />
        Équipe ({users.filter((u) => u.assigned).length})
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Utilisateurs — {shopNom}</DialogTitle>
        </DialogHeader>

        <TablePanel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Affecté</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="text-foreground">{u.nom}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell className="text-muted-foreground">{u.role}</TableCell>
                  <TableCell>
                    <Badge variant={u.assigned ? "success" : "secondary"}>
                      {u.assigned ? "Oui" : "Non"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <form action={u.assigned ? unassignUserFromShop : assignUserToShop}>
                      <input type="hidden" name="shopId" value={shopId} />
                      <input type="hidden" name="userId" value={u.id} />
                      <Button type="submit" variant="outline" size="sm">
                        {u.assigned ? "Retirer" : "Affecter"}
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Aucun utilisateur dans cette organisation.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TablePanel>
      </DialogContent>
    </Dialog>
  );
}
