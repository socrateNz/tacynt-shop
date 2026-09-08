"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PeriodFilter({ fromInput, toInput }: { fromInput: string; toInput: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [from, setFrom] = useState(fromInput);
  const [to, setTo] = useState(toInput);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    router.push(`${pathname}?from=${from}&to=${to}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="from">Du</Label>
        <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="to">Au</Label>
        <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <Button type="submit" variant="outline">
        Filtrer
      </Button>
    </form>
  );
}
