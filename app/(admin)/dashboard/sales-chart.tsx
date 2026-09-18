const WIDTH = 480;
const HEIGHT = 140;

// Server Component pur (pas de "use client") : la maquette de référence
// n'a aucune interactivité sur ce panneau (pas d'infobulle au survol), donc
// un SVG dessiné à la main au rendu serveur suffit — pas de dépendance de
// graphique dans ce repo, inutile d'en ajouter une pour un simple tracé.
export function SalesChart({
  data,
}: {
  data: { date: string; total: number }[];
}) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Pas encore de ventes sur cette période.</p>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.total), 0);
  const points = data.map((d, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * WIDTH : WIDTH / 2;
    const y = maxValue > 0 ? HEIGHT - (d.total / maxValue) * HEIGHT : HEIGHT;
    return { x, y };
  });

  const firstLabel = formatDayLabel(data[0].date);
  const lastLabel = formatDayLabel(data[data.length - 1].date);

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-36 w-full"
        role="img"
        aria-label="Chiffre d'affaires par jour"
      >
        <line
          x1={0}
          y1={HEIGHT - 0.5}
          x2={WIDTH}
          y2={HEIGHT - 0.5}
          stroke="var(--border)"
          strokeWidth={1}
        />
        {points.length < 2 ? (
          <circle cx={points[0].x} cy={points[0].y} r={4} fill="var(--primary)" />
        ) : (
          <>
            <path
              d={`${points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")} L${WIDTH},${HEIGHT} L0,${HEIGHT} Z`}
              fill="var(--primary)"
              fillOpacity={0.12}
              stroke="none"
            />
            <path
              d={points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="var(--primary)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </>
        )}
      </svg>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{firstLabel}</span>
        <span>{lastLabel}</span>
      </div>
    </div>
  );
}

function formatDayLabel(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return `${day}/${month}`;
}
