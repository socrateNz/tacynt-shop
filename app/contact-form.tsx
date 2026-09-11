"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { submitContactRequest, type ContactFormState } from "./contact-actions";

const initialState: ContactFormState = { error: null, success: false };

export function ContactForm() {
  const [state, formAction, isPending] = useActionState(submitContactRequest, initialState);

  if (state.success) {
    return (
      <p className="rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
        Merci, votre demande a bien été reçue — nous revenons vers vous rapidement.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nom">Nom</Label>
          <Input id="nom" name="nom" required placeholder="Votre nom" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required placeholder="vous@exemple.com" />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="message">Message</Label>
        <Textarea
          id="message"
          name="message"
          required
          rows={4}
          placeholder="Parlez-nous de votre boutique..."
        />
      </div>
      <Button type="submit" className="self-start" disabled={isPending}>
        {isPending ? "Envoi..." : "Envoyer"}
      </Button>
    </form>
  );
}
