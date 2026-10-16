import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { ChevronRight, PackageSearch } from "lucide-react";
import type { UserInventoryProduct } from "@/lib/api";

type AssistantAnswerProps = {
  text: string;
  products: UserInventoryProduct[];
  onProductClick: () => void;
};

function renderInline(text: string): ReactNode[] {
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);
  return tokens.map((token, index) => {
    const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-2">{link[1]}</a>;
    if (token.startsWith("**") && token.endsWith("**")) return <strong key={index} className="font-semibold text-foreground">{token.slice(2, -2)}</strong>;
    if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_"))) return <em key={index}>{token.slice(1, -1)}</em>;
    if (token.startsWith("`") && token.endsWith("`")) return <code key={index} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">{token.slice(1, -1)}</code>;
    return <Fragment key={index}>{token}</Fragment>;
  });
}

function renderAnswerText(text: string) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index += 1; continue; }

    if (line.startsWith("```") || line.startsWith("~~~")) {
      const marker = line.slice(0, 3);
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].trim().startsWith(marker)) code.push(lines[index++]);
      if (index < lines.length) index += 1;
      blocks.push(<pre key={`code-${index}`} className="overflow-x-auto rounded-xl border border-border/70 bg-muted/60 p-3 text-xs leading-5"><code className="font-mono">{code.join("\n")}</code></pre>);
      continue;
    }

    const isTableSeparator = (value: string) => /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(value.trim());
    if (line.includes("|") && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const cells = (row: string) => row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
      const headers = cells(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].trim().includes("|")) rows.push(cells(lines[index++]));
      blocks.push(<div key={`table-${index}`} className="overflow-x-auto rounded-xl border border-border/70"><table className="w-full min-w-[360px] border-collapse text-left text-xs leading-5"><thead className="bg-muted/70"><tr>{headers.map((cell, cellIndex) => <th key={cellIndex} className="border-b border-border px-3 py-2 font-semibold text-foreground">{renderInline(cell)}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="odd:bg-background even:bg-muted/25">{headers.map((_, cellIndex) => <td key={cellIndex} className="border-b border-border/60 px-3 py-2 align-top">{renderInline(row[cellIndex] ?? "")}</td>)}</tr>)}</tbody></table></div>);
      continue;
    }

    if (/^(---+|\*\*\*+|___+)$/.test(line)) {
      blocks.push(<hr key={index} className="border-border" />);
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const className = level === 1 ? "text-base font-semibold tracking-tight" : "text-sm font-semibold tracking-tight";
      blocks.push(<h3 key={index} className={className}>{renderInline(heading[2])}</h3>);
      index += 1;
      continue;
    }

    const listMatch = line.match(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/);
    if (listMatch) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const items: ReactNode[] = [];
      while (index < lines.length) {
        const item = lines[index].trim().match(/^(?:[-*+]\s+|\d+[.)]\s+)(\[[ xX]\]\s+)?(.+)$/);
        if (!item) break;
        items.push(<li key={index} className="pl-1.5">{item[1] ? <span className="mr-1 text-primary">{item[1].toLowerCase().includes("x") ? "✓" : "○"}</span> : null}{renderInline(item[2])}</li>);
        index += 1;
      }
      const List = ordered ? "ol" : "ul";
      blocks.push(<List key={`list-${index}`} className={`space-y-1.5 pl-5 ${ordered ? "list-decimal" : "list-disc marker:text-primary/60"}`}>{items}</List>);
      continue;
    }

    if (line.startsWith("> ")) {
      blocks.push(<blockquote key={index} className="border-l-2 border-primary/40 pl-3 text-muted-foreground">{renderInline(line.slice(2))}</blockquote>);
      index += 1;
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !/^(#{1,3})\s+/.test(lines[index].trim()) && !/^\s*(?:[-*+]\s+|\d+[.)]\s+|>\s+)/.test(lines[index])) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push(<p key={`p-${index}`}>{renderInline(paragraph.join(" "))}</p>);
  }

  return blocks;
}

export function AssistantAnswer({ text, products, onProductClick }: AssistantAnswerProps) {
  const mentionedProducts = products.filter((product) =>
    product.name && text.toLocaleLowerCase().includes(product.name.toLocaleLowerCase()),
  );

  return (
    <div className="min-w-0 space-y-4 text-sm leading-7 text-foreground [&_h3]:pt-1 [&_li]:leading-6">
      <div className="space-y-3">{renderAnswerText(text)}</div>
      {mentionedProducts.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {mentionedProducts.slice(0, 6).map((product) => (
            <Link key={product.id} href={`/user?product=${encodeURIComponent(product.id)}`} onClick={onProductClick}
              className="group overflow-hidden rounded-xl border border-border bg-card transition hover:border-primary/40 hover:shadow-md">
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                {product.imageUrl ? (
                  // Catalog images may be hosted remotely, so use a native image element.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.imageUrl} alt={product.name} loading="lazy" className="size-full object-cover transition duration-300 group-hover:scale-105" />
                ) : (
                  <div className="grid size-full place-items-center text-muted-foreground"><PackageSearch className="size-7" /></div>
                )}
              </div>
              <div className="flex items-center gap-1 px-2.5 py-2 text-xs font-medium">
                <span className="min-w-0 flex-1 truncate">{product.name}</span>
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
