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
    <Card>
      <CardHeader>
        <CardTitle>Price Update History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="scrollbar-hidden max-h-80 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Old Price</TableHead>
                <TableHead>New Price</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Changed At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length ? (
                history.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.changeType}</TableCell>
                    <TableCell>
                      {entry.oldPrice === null
                        ? "-"
                        : entry.oldPrice.toFixed(2)}
                    </TableCell>
                    <TableCell>{entry.newPrice.toFixed(2)}</TableCell>
                    <TableCell>{entry.currency}</TableCell>
                    <TableCell>
                      {new Date(entry.changedAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
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
