import { History, IndianRupee } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { HistoricalPrice } from "@/lib/api";

type PriceHistoryTableProps = {
  history: HistoricalPrice[];
};

export function PriceHistoryTable({ history }: PriceHistoryTableProps) {
  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="text-primary size-4" aria-hidden="true" />
          Price Update History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="scrollbar-hidden max-h-80 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Old Price</TableHead>
                <TableHead>New Price</TableHead>
                <TableHead>Changed At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length ? (
                history.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.changeType}</TableCell>
                    <TableCell>
                      {entry.oldPrice === null ? (
                        "-"
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <IndianRupee
                            className="size-3.5"
                            aria-hidden="true"
                          />
                          {entry.oldPrice.toFixed(2)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 font-medium">
                        <IndianRupee className="size-3.5" aria-hidden="true" />
                        {entry.newPrice.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date(entry.changedAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-muted-foreground text-sm"
                  >
                    No price history available for this product.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
