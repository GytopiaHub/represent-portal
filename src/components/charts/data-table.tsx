/** Table view for a chart, so values are never chart-only (a11y). */
export function ChartTable({ caption, rows, unit }: { caption: string; rows: { label: string; count: number }[]; unit: string }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Show as table</summary>
      <table className="mt-2 w-full">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-1 font-medium">Label</th>
            <th className="py-1 text-right font-medium">{unit}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t">
              <td className="py-1">{r.label}</td>
              <td className="py-1 text-right tabular-nums">{r.count.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
